/**
 * @file useMarkets.ts
 * @description Unified market discovery — backend first, multichain on-chain fallback.
 * Not dependent on wallet network selector. Persists via TanStack Query cache.
 */

import { useQuery } from '@tanstack/react-query';
import { type Address, parseAbi } from 'viem';
import { MARKET_FACTORY_ABI_TYPED, LENDING_MARKET_ABI } from '@/lib/contractAbis';
import { getContract } from '@/lib/contracts';
import { apiFetchJson, isBackendConfigured } from '@/lib/apiClient';
import { createChainClient, discoveryChainIds, DEFAULT_CHAIN_ID } from '@/lib/chains';

export interface Market {
  marketAddress: string;
  owner: string;
  collateralAsset: string;
  loanAsset: string;
  assetAdapter?: string;
  oracleAdapter?: string;
  complianceAdapter?: string;
  liquidationAdapter?: string;
  positionAdapter?: string;
  status?: number;
  assetType: number;
  oracleType: number;
  ltvBps: number;
  aprBps: number;
  durationSeconds: number;
  createdAt: number;
  active: boolean;
  liquidity: {
    total: string;
    available: string;
    reserved: string;
  };
  chainId?: number;
  providerId?: string | null;
}

async function fetchOnChainMarketsForChain(chainId: number): Promise<Market[]> {
  const factoryAddress = getContract(chainId, 'marketFactory');
  const publicClient = createChainClient(chainId);
  if (!factoryAddress || factoryAddress === '0x0000000000000000000000000000000000000000' || !publicClient) return [];

  let marketAddresses: string[] = [];
  try {
    marketAddresses = (await publicClient.readContract({
      address: factoryAddress as Address,
      abi: MARKET_FACTORY_ABI_TYPED,
      functionName: 'getAllMarkets',
    })) as string[];
  } catch {
    return [];
  }

  async function enrichMarket(addr: string): Promise<Market | null> {
    try {
      const [totalLiq, availLiq, totalBorrowed] = await publicClient.readContract({
        address: addr as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'getMarketStats',
      }) as [bigint, bigint, bigint, bigint, number];

      const [
        providerId,
        status,
        marketOwner,
        collateralAsset,
        loanAsset,
        assetAdapter,
        oracleAdapter,
        complianceAdapter,
        liquidationAdapter,
        positionAdapter,
        ltvBps,
        aprBps,
        durationSeconds,
      ] = await Promise.all([
        publicClient.readContract({
          address: factoryAddress as Address,
          abi: parseAbi(['function marketProvider(address) external view returns (bytes32)']),
          functionName: 'marketProvider',
          args: [addr as Address],
        }).catch(() => '0x' + '0'.repeat(64)),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'status' }).catch(() => 0),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'marketOwner' }).catch(() => ''),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'collateralAsset' }).catch(() => ''),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'lendingAsset' }).catch(() => ''),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'assetAdapter' }).catch(() => ''),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'oracleAdapter' }).catch(() => ''),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'complianceAdapter' }).catch(() => ''),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'liquidationAdapter' }).catch(() => ''),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'positionAdapter' }).catch(() => ''),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'ltvBps' }).catch(() => BigInt(0)),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'aprBps' }).catch(() => BigInt(0)),
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'durationSeconds' }).catch(() => BigInt(0)),
      ]);

      return {
        marketAddress: addr,
        owner: (marketOwner as string) || '',
        providerId: providerId as string,
        collateralAsset: collateralAsset as string,
        loanAsset: loanAsset as string,
        assetAdapter: assetAdapter as string,
        oracleAdapter: oracleAdapter as string,
        complianceAdapter: complianceAdapter as string,
        liquidationAdapter: liquidationAdapter as string,
        positionAdapter: positionAdapter as string,
        assetType: 0,
        oracleType: 0,
        ltvBps: Number(ltvBps),
        aprBps: Number(aprBps),
        durationSeconds: Number(durationSeconds),
        createdAt: 0,
        status: Number(status),
        active: Number(status) === 0,
        liquidity: {
          total: totalLiq.toString(),
          available: availLiq.toString(),
          reserved: totalBorrowed.toString(),
        },
        chainId,
      };
    } catch {
      return null;
    }
  }

  // Enrich markets in parallel batches for snappier loads
  const CONCURRENCY = 6;
  const markets: Market[] = [];
  for (let i = 0; i < marketAddresses.length; i += CONCURRENCY) {
    const batch = marketAddresses.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(enrichMarket));
    for (const m of results) if (m) markets.push(m);
  }
  return markets;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    t = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

async function fetchAggregatedOnChainMarkets(): Promise<Market[]> {
  const ids = discoveryChainIds();
  const batches = await Promise.all(
    ids.map((id) => withTimeout(fetchOnChainMarketsForChain(id), 7000, [] as Market[]))
  );
  const seen = new Set<string>();
  const all: Market[] = [];
  for (const batch of batches) {
    for (const m of batch) {
      const key = m.marketAddress.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        all.push(m);
      }
    }
  }
  return all;
}

export const useMarkets = (start = 0, count = 20) => {
  return useQuery<{ total: number; start: number; count: number; markets: Market[] }>({
    queryKey: ['markets', 'unified', start, count],
    queryFn: async () => {
      const shouldTryBackend = isBackendConfigured();
      if (shouldTryBackend) {
        const [backendData, onChainFallback] = await Promise.all([
          apiFetchJson<{ total: number; start: number; count: number; markets: Market[] }>(
            `/api/v1/markets?start=${start}&count=${count}`
          ),
          // Warm on-chain cache in parallel so fallback is instant if backend is empty/slow
          withTimeout(fetchAggregatedOnChainMarkets(), 6500, [] as Market[]),
        ]);
        if (backendData && Array.isArray(backendData.markets) && backendData.markets.length > 0) {
          return { total: backendData.total ?? backendData.markets.length, start: backendData.start ?? start, count: backendData.count ?? count, markets: backendData.markets };
        }
        if (onChainFallback.length > 0) {
          const sliced = onChainFallback.slice(start, start + count);
          return { total: onChainFallback.length, start, count, markets: sliced };
        }
      }

      const all = await fetchAggregatedOnChainMarkets();
      const sliced = all.slice(start, start + count);
      return { total: all.length, start, count, markets: sliced };
    },
    staleTime: 20_000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (prev) => prev,
  });
};

async function fetchMarketOnChain(address: string, chainId: number): Promise<Market | null> {
  const publicClient = createChainClient(chainId);
  if (!publicClient) return null;
  try {
    const factoryAddress = getContract(chainId, 'marketFactory');
    const [
      stats,
      providerId,
      status,
      marketOwner,
      collateralAsset,
      loanAsset,
      assetAdapter,
      oracleAdapter,
      complianceAdapter,
      liquidationAdapter,
      positionAdapter,
      ltvBps,
      aprBps,
      durationSeconds,
    ] = await Promise.all([
      publicClient.readContract({
        address: address as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'getMarketStats',
      }) as Promise<[bigint, bigint, bigint, bigint, number]>,
      factoryAddress
        ? publicClient.readContract({
            address: factoryAddress as Address,
            abi: parseAbi(['function marketProvider(address) external view returns (bytes32)']),
            functionName: 'marketProvider',
            args: [address as Address],
          }).catch(() => '0x' + '0'.repeat(64))
        : Promise.resolve('0x' + '0'.repeat(64)),
      publicClient.readContract({
        address: address as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'status',
      }) as Promise<number>,
      publicClient.readContract({
        address: address as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'marketOwner',
      }).catch(() => '') as Promise<string>,
      publicClient.readContract({ address: address as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'collateralAsset' }) as Promise<string>,
      publicClient.readContract({ address: address as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'lendingAsset' }) as Promise<string>,
      publicClient.readContract({ address: address as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'assetAdapter' }) as Promise<string>,
      publicClient.readContract({ address: address as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'oracleAdapter' }) as Promise<string>,
      publicClient.readContract({ address: address as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'complianceAdapter' }) as Promise<string>,
      publicClient.readContract({ address: address as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'liquidationAdapter' }) as Promise<string>,
      publicClient.readContract({ address: address as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'positionAdapter' }) as Promise<string>,
      publicClient.readContract({ address: address as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'ltvBps' }) as Promise<bigint>,
      publicClient.readContract({ address: address as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'aprBps' }) as Promise<bigint>,
      publicClient.readContract({ address: address as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'durationSeconds' }) as Promise<bigint>,
    ]);

    return {
      marketAddress: address,
      owner: (marketOwner as string) || '',
      providerId: providerId as string,
      collateralAsset: collateralAsset as string,
      loanAsset: loanAsset as string,
      assetAdapter: assetAdapter as string,
      oracleAdapter: oracleAdapter as string,
      complianceAdapter: complianceAdapter as string,
      liquidationAdapter: liquidationAdapter as string,
      positionAdapter: positionAdapter as string,
      assetType: 0,
      oracleType: 0,
      ltvBps: Number(ltvBps),
      aprBps: Number(aprBps),
      durationSeconds: Number(durationSeconds),
      createdAt: 0,
      status: Number(status),
      active: (status as number) === 0,
      liquidity: {
        total: (stats[0] as bigint).toString(),
        available: (stats[1] as bigint).toString(),
        reserved: (stats[2] as bigint).toString(),
      },
      chainId,
    };
  } catch {
    return null;
  }
}

export const useMarket = (address: string) => {
  return useQuery<Market>({
    queryKey: ['market', address?.toLowerCase()],
    queryFn: async () => {
      if (!address || !address.startsWith('0x')) throw new Error('Invalid market address');
      if (isBackendConfigured()) {
        try {
          const data = await withTimeout(apiFetchJson<Market>(`/api/v1/markets/${address}`), 3500, null);
          if (data && (data as any).marketAddress) return data as Market;
        } catch {
          // fall through to on-chain
        }
      }

      // Probe all chains in parallel — first chain that resolves wins (discovery order prioritized)
      const ids = discoveryChainIds();
      const results = await Promise.allSettled(
        ids.map((id) => withTimeout(fetchMarketOnChain(address, id), 6000, null))
      );

      // Prefer discovery order (DEFAULT_CHAIN_ID first)
      for (const id of ids) {
        const idx = ids.indexOf(id);
        const r = results[idx];
        if (r.status === 'fulfilled' && r.value) return r.value;
      }
      // Fallback: any fulfilled value
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) return r.value;
      }
      throw new Error('Market not found on any supported chain');
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 20_000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
  });
};

export const useMarketLiquidity = (address: string) => {
  return useQuery({
    queryKey: ['marketLiquidity', address],
    queryFn: async () => {
      if (isBackendConfigured()) {
        const data = await apiFetchJson<{ total: string; available: string; reserved: string }>(`/api/v1/markets/${address}/liquidity`);
        if (data && (data as any).total) return data;
      }

      if (!address) throw new Error('Cannot fetch liquidity');

      for (const chainId of discoveryChainIds()) {
        const publicClient = createChainClient(chainId);
        if (!publicClient) continue;
        try {
          const [totalLiq, availLiq] = await publicClient.readContract({
            address: address as Address,
            abi: parseAbi(LENDING_MARKET_ABI),
            functionName: 'getMarketStats',
          }) as [bigint, bigint];
          return { total: totalLiq.toString(), available: availLiq.toString(), reserved: '0', chainId };
        } catch {}
      }
      // graceful empty, not throw for UX
      return { total: '0', available: '0', reserved: '0' };
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 15000,
    gcTime: 120000,
    retry: 1,
  });
};
