/**
 * @file usePlatformStats.ts
 * @description Platform stats from unified market discovery (backend + on-chain fallback).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetchJson } from '@/lib/apiClient';
import { useMarkets } from '@/hooks/useMarkets';
import { resolveAssetIdentity } from '@/lib/assetIdentity';

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
  const marketsQuery = useMarkets(0, 500);
  const loansQuery = useQuery({
    queryKey: ['platformStats', 'loans'],
    queryFn: async () => apiFetchJson<{ total: number; loans: any[] }>(`/api/v1/loans?take=100&skip=0`),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 0,
  });

  const data = useMemo<PlatformStats>(() => {
    const markets = marketsQuery.data?.markets || [];
    let totalActiveMarkets = 0;
    const catCounts: Record<string, number> = {
      Tokens: 0,
      NFT: 0,
      RWA: 0,
      'Tokenized Equities': 0,
    };

    let liquidityWei = BigInt(0);
    for (const m of markets) {
      if (m.active) totalActiveMarkets++;
      const identity = resolveAssetIdentity({ market: m, tokenSymbol: null, tokenName: null, tokenLogoUri: null, loanAssetSymbol: null });
      const cat = identity.category || 'Tokens';
      if (cat in catCounts) catCounts[cat]++;
      else catCounts.Tokens++;
      try {
        liquidityWei += BigInt(m.liquidity?.total || '0');
      } catch { /* skip */ }
    }

    const loans = loansQuery.data?.loans || [];
    let totalActiveLoans = 0;
    let collateralWei = BigInt(0);
    for (const loan of loans) {
      if (loan.status === 'ACTIVE' || loan.status === 0) {
        totalActiveLoans++;
        if (loan.collateralAmount) {
          try { collateralWei += BigInt(loan.collateralAmount); } catch { /* skip */ }
        }
      }
    }

    const totalMarketCount = Math.max(totalActiveMarkets, 1);
    const assetDistribution: AssetDistribution[] = [
      { label: 'ERC20 Tokens', count: catCounts.Tokens, color: COLORS[0] },
      { label: 'NFT (ERC721)', count: catCounts.NFT, color: COLORS[1] },
      { label: 'RWA', count: catCounts.RWA, color: COLORS[2] },
      { label: 'Tokenized Equities', count: catCounts['Tokenized Equities'], color: COLORS[3] },
    ];

    const assetCategories: AssetCategory[] = [
      {
        id: 'erc20',
        name: 'ERC20 Tokens',
        count: catCounts.Tokens,
        value: catCounts.Tokens,
        percentage: Math.round((catCounts.Tokens / totalMarketCount) * 1000) / 10,
        color: CATEGORY_COLORS.erc20,
      },
      {
        id: 'nft',
        name: 'NFT (ERC721)',
        count: catCounts.NFT,
        value: catCounts.NFT,
        percentage: Math.round((catCounts.NFT / totalMarketCount) * 1000) / 10,
        color: CATEGORY_COLORS.nft,
      },
      {
        id: 'rwa',
        name: 'Real World Assets (RWA)',
        count: catCounts.RWA,
        value: catCounts.RWA,
        percentage: Math.round((catCounts.RWA / totalMarketCount) * 1000) / 10,
        color: CATEGORY_COLORS.rwa,
      },
      {
        id: 'equities',
        name: 'Tokenized Equities',
        count: catCounts['Tokenized Equities'],
        value: catCounts['Tokenized Equities'],
        percentage: Math.round((catCounts['Tokenized Equities'] / totalMarketCount) * 1000) / 10,
        color: CATEGORY_COLORS.equities,
      },
    ];

    return {
      totalActiveMarkets,
      totalActiveLoans,
      totalCollateral: collateralWei > 0 ? formatUsd(collateralWei.toString()) : formatUsd(liquidityWei.toString()),
      totalValue: totalActiveMarkets,
      performance30d: 0,
      assetDistribution,
      assetCategories,
    };
  }, [marketsQuery.data, loansQuery.data]);

  return {
    data,
    isLoading: marketsQuery.isLoading,
  };
};
