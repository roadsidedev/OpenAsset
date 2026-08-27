/**
 * @file usePlatformStats.ts
 * @description Platform stats from live on-chain market discovery.
 */

import { useMemo } from 'react';
import { useMarkets } from './useMarkets';
import { resolveAssetIdentity, type AssetCategory as IdentityCategory } from '@/lib/assetIdentity';

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
    return `$${base.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  } catch {
    return '$0';
  }
}

const CATEGORY_META: { id: string; name: string; identity: IdentityCategory; color: string }[] = [
  { id: 'tokens', name: 'ERC20 Tokens', identity: 'Tokens', color: '#4F46E5' },
  { id: 'nft', name: 'NFT (ERC721)', identity: 'NFT', color: '#06B6D4' },
  { id: 'equities', name: 'Tokenized Equities', identity: 'Tokenized Equities', color: '#8B5CF6' },
  { id: 'rwa', name: 'Real World Assets (RWA)', identity: 'RWA', color: '#F59E0B' },
];

export const usePlatformStats = () => {
  const { data, isLoading, error, isFetching } = useMarkets(0, 500);
  const markets = useMemo(() => data?.markets ?? [], [data?.markets]);

  const stats = useMemo<PlatformStats>(() => {
    const counts: Record<IdentityCategory, number> = {
      Tokens: 0,
      NFT: 0,
      RWA: 0,
      'Tokenized Equities': 0,
    };
    let totalActiveMarkets = 0;
    let totalActiveLoans = 0;
    let liquidityWei = BigInt(0);

    for (const market of markets) {
      if (market.active) totalActiveMarkets++;
      totalActiveLoans += Number(market.activeLoanCount || 0);
      try {
        liquidityWei += BigInt(market.liquidity?.total || '0');
      } catch { /* skip */ }
      const identity = resolveAssetIdentity({ market });
      counts[identity.category] += 1;
    }

    const denominator = markets.length || 1;
    const assetCategories: AssetCategory[] = CATEGORY_META.map((meta) => {
      const count = counts[meta.identity];
      return {
        id: meta.id,
        name: meta.name,
        count,
        value: count,
        percentage: Math.round((count / denominator) * 1000) / 10,
        color: meta.color,
        itemDetails: [],
      };
    });

    const assetDistribution: AssetDistribution[] = assetCategories.map((c) => ({
      label: c.name,
      count: c.count,
      color: c.color,
    }));

    return {
      totalActiveMarkets,
      totalActiveLoans,
      totalCollateral: formatUsd(liquidityWei.toString()),
      totalValue: totalActiveMarkets,
      performance30d: 0,
      assetDistribution,
      assetCategories,
    };
  }, [markets]);

  return { data: stats, isLoading, error, isFetching };
};
