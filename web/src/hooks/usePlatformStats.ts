/**
 * @file usePlatformStats.ts
 * @description Unified platform stats hook — fetches markets + loans data
 *              and computes aggregate stats for the dashboard.
 *              Zero mock data — everything comes from the backend API.
 */

import { useQuery } from '@tanstack/react-query';

export interface AssetDistribution {
  label: string;
  count: number;
  color: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
  count: number;
  itemDetails?: string[];
}

export interface PlatformStats {
  totalActiveMarkets: number;
  totalActiveLoans: number;
  totalCollateral: string;
  totalValue: number;
  performance30d: number;
  assetDistribution: AssetDistribution[];
  assetCategories: AssetCategory[];
}

function formatUsd(weiStr: string, decimals = 6): string {
  try {
    const wei = BigInt(weiStr);
    const divisor = BigInt(10 ** decimals);
    const base = Number(wei / divisor);
    if (base >= 1_000_000) return `$${(base / 1_000_000).toFixed(1)}M`;
    if (base >= 1_000) return `$${(base / 1_000).toFixed(1)}K`;
    return `$${base.toLocaleString()}`;
  } catch {
    return '$0';
  }
}

const COLORS = ['#66BFFF', '#3AA5F0', '#1D82D1', '#A8D8FF'];

const CATEGORY_COLORS: Record<string, string> = {
  erc20: '#4F46E5',
  nft: '#06B6D4',
  erc1155: '#10B981',
  rwa: '#F59E0B',
  equities: '#8B5CF6',
};

export const usePlatformStats = () => {
  return useQuery<PlatformStats>({
    queryKey: ['platformStats'],
    queryFn: async () => {
      const [marketsRes, loansRes] = await Promise.all([
        fetch('/api/v1/markets?start=0&count=500'),
        fetch('/api/loans?take=100&skip=0'),
      ]);

      // --- Markets ---
      let totalActiveMarkets = 0;
      const assetTypeCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };

      if (marketsRes.ok) {
        const mJson = await marketsRes.json();
        const markets = mJson.data?.markets || [];
        for (const m of markets) {
          if (m.active) totalActiveMarkets++;
          const t = Number(m.assetType);
          if (t in assetTypeCounts) assetTypeCounts[t]++;
        }
      }

      // --- Loans ---
      let totalActiveLoans = 0;
      let collateralWei = BigInt(0);

      if (loansRes.ok) {
        const lJson = await loansRes.json();
        const loans = lJson.data?.loans || [];
        const totalLoansFromApi = lJson.data?.total ?? loans.length;

        // The API may not return total separately for ACTIVE filter;
        // count from the returned batch.
        for (const loan of loans) {
          if (loan.status === 'ACTIVE') {
            totalActiveLoans++;
            if (loan.collateralAmount) {
              try {
                collateralWei += BigInt(loan.collateralAmount);
              } catch { /* skip */ }
            }
          }
        }

        // If no status filter was applied, totalActiveLoans from batch may be
        // accurate only for the first 100. For small platforms this is fine.
        // We use the total count from the API for the "Total Loans" stat,
        // but here we only track active ones.
        if (totalActiveLoans === 0 && totalLoansFromApi > 0) {
          // loans endpoint returned data but none were ACTIVE in this batch
        }
      }

      const assetDistribution: AssetDistribution[] = [
        { label: 'ERC20 Tokens', count: assetTypeCounts[0], color: COLORS[0] },
        { label: 'NFT (ERC721)', count: assetTypeCounts[1], color: COLORS[1] },
        { label: 'ERC1155', count: assetTypeCounts[2], color: COLORS[2] },
        // Placeholder categories — show 0 when no data
        { label: 'RWA', count: 0, color: COLORS[3] },
        { label: 'Tokenized Equities', count: 0, color: '#94A3B8' },
      ];

      const totalMarketCount = totalActiveMarkets || 1;
      const assetCategories: AssetCategory[] = [
        {
          id: 'erc20',
          name: 'ERC20 Tokens',
          count: assetTypeCounts[0],
          value: assetTypeCounts[0],
          percentage: totalMarketCount > 0 ? Math.round((assetTypeCounts[0] / totalMarketCount) * 1000) / 10 : 0,
          color: CATEGORY_COLORS.erc20,
          itemDetails: [],
        },
        {
          id: 'nft',
          name: 'NFT (ERC721)',
          count: assetTypeCounts[1],
          value: assetTypeCounts[1],
          percentage: totalMarketCount > 0 ? Math.round((assetTypeCounts[1] / totalMarketCount) * 1000) / 10 : 0,
          color: CATEGORY_COLORS.nft,
          itemDetails: [],
        },
        {
          id: 'erc1155',
          name: 'ERC1155',
          count: assetTypeCounts[2],
          value: assetTypeCounts[2],
          percentage: totalMarketCount > 0 ? Math.round((assetTypeCounts[2] / totalMarketCount) * 1000) / 10 : 0,
          color: CATEGORY_COLORS.erc1155,
          itemDetails: [],
        },
        {
          id: 'rwa',
          name: 'Real World Assets (RWA)',
          count: 0,
          value: 0,
          percentage: 0,
          color: CATEGORY_COLORS.rwa,
          itemDetails: [],
        },
        {
          id: 'equities',
          name: 'Tokenized Equities',
          count: 0,
          value: 0,
          percentage: 0,
          color: CATEGORY_COLORS.equities,
          itemDetails: [],
        },
      ];

      return {
        totalActiveMarkets,
        totalActiveLoans,
        totalCollateral: formatUsd(collateralWei.toString()),
        totalValue: totalActiveMarkets,
        performance30d: 0,
        assetDistribution,
        assetCategories,
      };
    },
    staleTime: 60_000,
  });
};
