/**
 * @file useMarkets.ts
 * @description Hook for querying markets from backend API with on-chain fallback
 */

import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useAccount } from 'wagmi';
import { type Address, parseAbi } from 'viem';
import { MARKET_FACTORY_ABI, LENDING_MARKET_ABI } from '@/lib/contractAbis';
import { getContract } from '@/lib/contracts';

export interface Market {
  marketAddress: string;
  owner: string;
  collateralAsset: string;
  loanAsset: string;
  assetAdapter?: string;
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
}

async function fetchOnChainMarkets(publicClient: ReturnType<typeof usePublicClient>, chainId: number): Promise<Market[]> {
  const factoryAddress = getContract(chainId, 'marketFactory');
  if (!factoryAddress || !publicClient) throw new Error('Chain not supported');

  const marketAddresses = await publicClient.readContract({
    address: factoryAddress as Address,
    abi: parseAbi(MARKET_FACTORY_ABI),
    functionName: 'getAllMarkets',
  }) as string[];

  const markets: Market[] = [];
  for (const addr of marketAddresses) {
    try {
      const [totalLiq, availLiq, totalBorrowed] = await publicClient.readContract({
        address: addr as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'getMarketStats',
      }) as [bigint, bigint, bigint, bigint, number];

      const status = await publicClient.readContract({
        address: addr as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'status',
      }) as number;

      markets.push({
        marketAddress: addr,
        owner: '',
        collateralAsset: '',
        loanAsset: '',
        assetType: 0,
        oracleType: 0,
        ltvBps: 0,
        aprBps: 0,
        durationSeconds: 0,
        createdAt: 0,
        active: status === 0,
        liquidity: {
          total: totalLiq.toString(),
          available: availLiq.toString(),
          reserved: totalBorrowed.toString(),
        },
      });
    } catch {
      // Skip markets that fail to read
    }
  }
  return markets;
}

export const useMarkets = (start = 0, count = 20) => {
  const publicClient = usePublicClient();
  const { chain } = useAccount();
  const chainId = chain?.id;

  return useQuery<{ total: number; start: number; count: number; markets: Market[] }>({
    queryKey: ['markets', start, count, chainId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/v1/markets?start=${start}&count=${count}`);
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch {
        // Backend unavailable, fall through to on-chain
      }

      // On-chain fallback
      const chainMarkets = await fetchOnChainMarkets(publicClient, chainId);
      return { total: chainMarkets.length, start, count, markets: chainMarkets };
    },
    staleTime: 30000,
  });
};

export const useMarket = (address: string) => {
  const publicClient = usePublicClient();
  const { chain } = useAccount();
  const chainId = chain?.id;

  return useQuery<Market>({
    queryKey: ['market', address, chainId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/v1/markets/${address}`);
        if (res.ok) {
          return (await res.json()).data;
        }
      } catch {
        // Fall through to on-chain
      }

      if (!publicClient || !address) throw new Error('Cannot fetch market');

      const stats = await publicClient.readContract({
        address: address as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'getMarketStats',
      }) as [bigint, bigint, bigint, bigint, number];

      const status = await publicClient.readContract({
        address: address as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'status',
      }) as number;

      return {
        marketAddress: address,
        owner: '',
        collateralAsset: '',
        loanAsset: '',
        assetType: 0,
        oracleType: 0,
        ltvBps: 0,
        aprBps: 0,
        durationSeconds: 0,
        createdAt: 0,
        active: (status as number) === 0,
        liquidity: {
          total: (stats[0] as bigint).toString(),
          available: (stats[1] as bigint).toString(),
          reserved: (stats[2] as bigint).toString(),
        },
      };
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 30000,
  });
};

export const useMarketLiquidity = (address: string) => {
  const publicClient = usePublicClient();
  const { chain } = useAccount();
  const chainId = chain?.id;

  return useQuery({
    queryKey: ['marketLiquidity', address, chainId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/v1/markets/${address}/liquidity`);
        if (res.ok) return (await res.json()).data;
      } catch {}

      if (!publicClient || !address) throw new Error('Cannot fetch liquidity');

      const [totalLiq, availLiq] = await publicClient.readContract({
        address: address as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'getMarketStats',
      }) as [bigint, bigint];

      return { total: totalLiq.toString(), available: availLiq.toString(), reserved: '0' };
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 15000,
  });
};
