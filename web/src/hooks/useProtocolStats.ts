/**
 * @file useProtocolStats.ts
 * @description Aggregates protocol-wide stats from live market data.
 *              Fetches all markets and computes TVL, active count, etc.
 *              Zero mock data — everything comes from the backend API.
 */

import { useQuery } from '@tanstack/react-query';
import { apiFetchJson } from '@/lib/apiClient';

export interface ProtocolStats {
  tvl: string;
  activeMarkets: number;
  totalMarkets: number;
}

export const useProtocolStats = () => {
  return useQuery<ProtocolStats>({
    queryKey: ['protocolStats'],
    queryFn: async () => {
      const data = await apiFetchJson<{ total: number; markets: any[] }>(`/api/v1/markets?start=0&count=500`);
      const markets = data?.markets || [];

      let tvl = BigInt(0);
      let activeMarkets = 0;

      for (const market of markets) {
        if (market.active) activeMarkets++;
        const total = market.liquidity?.total;
        if (total) {
          try {
            tvl += BigInt(total);
          } catch {
            // skip malformed values
          }
        }
      }

      return {
        tvl: tvl.toString(),
        activeMarkets,
        totalMarkets: (data as any)?.total ?? markets.length,
      };
    },
    staleTime: 60_000,
    gcTime: 300000,
    refetchInterval: 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
};

/**
 * Format a wei liquidity string into a human-readable short form (e.g. "$1.2M+").
 * Assumes 6 decimals (USDC).
 */
export function formatTvl(weiStr: string, decimals = 6): string {
  try {
    const wei = BigInt(weiStr);
    const divisor = BigInt(10 ** decimals);
    const base = Number(wei / divisor);

    if (base >= 1_000_000) {
      return `$${(base / 1_000_000).toFixed(1)}M+`;
    }
    if (base >= 1_000) {
      return `$${(base / 1_000).toFixed(1)}K+`;
    }
    return `$${base.toLocaleString()}`;
  } catch {
    return '$0';
  }
}
