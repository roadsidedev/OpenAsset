/**
 * @file useMarkets.ts
 * @description Hook for querying markets from backend API
 */

import { useQuery } from '@tanstack/react-query';

export interface Market {
  marketAddress: string;
  owner: string;
  collateralAsset: string;
  loanAsset: string;
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

export const useMarkets = (start = 0, count = 20) => {
  return useQuery<{ total: number; start: number; count: number; markets: Market[] }>({
    queryKey: ['markets', start, count],
    queryFn: async () => {
      const res = await fetch(`/api/v1/markets?start=${start}&count=${count}`);
      if (!res.ok) throw new Error('Failed to fetch markets');
      return res.json().then((r) => r.data);
    },
    staleTime: 30000,
  });
};

export const useMarket = (address: string) => {
  return useQuery<Market>({
    queryKey: ['market', address],
    queryFn: async () => {
      const res = await fetch(`/api/v1/markets/${address}`);
      if (!res.ok) throw new Error('Failed to fetch market');
      return res.json().then((r) => r.data);
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 30000,
  });
};

export const useMarketLiquidity = (address: string) => {
  return useQuery({
    queryKey: ['marketLiquidity', address],
    queryFn: async () => {
      const res = await fetch(`/api/v1/markets/${address}/liquidity`);
      if (!res.ok) throw new Error('Failed to fetch liquidity');
      return res.json().then((r) => r.data);
    },
    enabled: !!address && address.startsWith('0x'),
    staleTime: 15000,
  });
};
