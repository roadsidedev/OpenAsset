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
  activeLoanCount?: number;
  liquidity: {
    total: string;
    available: string;
    reserved: string;
  };
  chainId?: number;
  providerId?: string | null;
}

async function fetchOnChainMarketsForChain(chainId: number): Promise<Market[]> {
  try {
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

  const ERC721_OWNER_ABI = ['function ownerOf(uint256 tokenId) external view returns (address)'];

  const markets: Market[] = [];
  for (const addr of marketAddresses) {
    try {
      const [totalLiq, availLiq, totalBorrowed, activeLoanCount] = await publicClient.readContract({
        address: addr as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'getMarketStats',
      }) as [bigint, bigint, bigint, bigint, number];

      const [
        providerId,
        status,
        lpTokenAddr,
        marketOwnerAddr,
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
        publicClient.readContract({ address: addr as Address, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'lpToken' }).catch(() => '0x0000000000000000000000000000000000000000'),
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

      let lpOwner = (marketOwnerAddr as string) || '';
      if (!lpOwner && lpTokenAddr && lpTokenAddr !== '0x0000000000000000000000000000000000000000') {
        try {
          lpOwner = (await publicClient.readContract({
            address: lpTokenAddr as Address,
            abi: parseAbi(ERC721_OWNER_ABI),
            functionName: 'ownerOf',
            args: [BigInt(0)],
          }) as string) || '';
        } catch {
          try {
            lpOwner = (await publicClient.readContract({
              address: lpTokenAddr as Address,
              abi: parseAbi(ERC721_OWNER_ABI),
              functionName: 'ownerOf',
              args: [BigInt(1)],
            }) as string) || '';
          } catch {}
        }
      }

      markets.push({
        marketAddress: addr,
        owner: lpOwner,
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
        activeLoanCount: Number(activeLoanCount || 0),
        liquidity: {
          total: totalLiq.toString(),
          available: availLiq.toString(),
          reserved: totalBorrowed.toString(),
        },
        chainId,
      });
    } catch {
      // Skip markets that fail to read
    }
  }
  return markets;
  } catch {
    return [];
  }
}

async function fetchAggregatedOnChainMarkets(): Promise<Market[]> {
  const ids = discoveryChainIds();
  const batches = await Promise.all(ids.map(async (id) => {
    try {
      return await fetchOnChainMarketsForChain(id);
    } catch {
      return [];
    }
  }));
  // flatten and deduplicate by marketAddress
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
      // 1) Try backend — unified discovery layer (already aggregates chains via indexer)
      // This path is chain-agnostic and preferred. Only hit backend if configured to avoid 404 spam.
      const shouldTryBackend = isBackendConfigured();
      if (shouldTryBackend) {
        const data = await apiFetchJson<{ total: number; start: number; count: number; markets: Market[] }>(
          `/api/v1/markets?start=${start}&count=${count}`
        );
        if (data && Array.isArray(data.markets)) {
          // backend may return empty even when on-chain has data (indexer lag) → merge fallback below
          if (data.markets.length > 0) {
            return { total: data.total ?? data.markets.length, start: data.start ?? start, count: data.count ?? count, markets: data.markets };
          }
        }
      } else {
        // No backend configured (local / missing env) → avoid noisy 404 fetch, go straight to on-chain
      }

      // 2) Fallback: multichain on-chain aggregation (not dependent on wallet)
      const all = await fetchAggregatedOnChainMarkets();
      const sliced = all.slice(start, start + count);
      return { total: all.length, start, count, markets: sliced };
    },
    staleTime: 15000,
    gcTime: 300000,
    retry: 1,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });
};

export const useMarket = (address: string) => {
  return useQuery<Market>({
    queryKey: ['market', address],
    queryFn: async () => {
      // backend preferred, but skip noisy fetch if not configured
      if (isBackendConfigured()) {
        const data = await apiFetchJson<Market>(`/api/v1/markets/${address}`);
        if (data && (data as any).marketAddress) return data as Market;
      }

      if (!address) throw new Error('Cannot fetch market');

      // fallback: try each chain's public client
      const ERC721_OWNER_ABI = ['function ownerOf(uint256 tokenId) external view returns (address)'];
      for (const chainId of discoveryChainIds()) {
        const publicClient = createChainClient(chainId);
        if (!publicClient) continue;
        try {
          const factoryAddress = getContract(chainId, 'marketFactory');
          const [
            stats,
            providerId,
            status,
              lpTokenAddr,
              marketOwnerAddr,
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
              functionName: 'lpToken',
            }).catch(() => '0x0000000000000000000000000000000000000000') as Promise<string>,
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

          let lpOwner = (marketOwnerAddr as string) || '';
          if (!lpOwner && lpTokenAddr && lpTokenAddr !== '0x0000000000000000000000000000000000000000') {
            try {
              lpOwner = (await publicClient.readContract({
                address: lpTokenAddr as Address,
                abi: parseAbi(ERC721_OWNER_ABI),
                functionName: 'ownerOf',
                args: [BigInt(0)],
              }) as string) || '';
            } catch {
              try {
                lpOwner = (await publicClient.readContract({
                  address: lpTokenAddr as Address,
                  abi: parseAbi(ERC721_OWNER_ABI),
                  functionName: 'ownerOf',
                  args: [BigInt(1)],
                }) as string) || '';
              } catch {}
            }
          }

          return {
            marketAddress: address,
            owner: lpOwner,
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
            activeLoanCount: Number(stats[3] || 0),
            liquidity: {
              total: (stats[0] as bigint).toString(),
              available: (stats[1] as bigint).toString(),
              reserved: (stats[2] as bigint).toString(),
            },
            chainId,
          };
        } catch {
          // try next chain
        }
      }
      throw new Error('Market not found on any supported chain');
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 30000,
    gcTime: 300000,
    retry: 1,
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
