'use client';

import { useMemo } from 'react';
import { useBatchTokenMetadata } from './useBatchTokenMetadata';
import { resolveAssetIdentity, type AssetIdentity, getOracleLabel } from '@/lib/assetIdentity';
import type { Market } from './useMarkets';

export interface EnrichedMarket {
  market: Market;
  identity: AssetIdentity;
  oracleLabel: string;
  loanAssetSymbol: string | null;
}

export function useEnrichedMarkets(markets: Market[], defaultChainId?: number) {
  // Collect collateral + loan addresses per chain group
  // Group by chainId to avoid cross-chain token reads causing wrong metadata
  // For simplicity, use per-market default chain (market.chainId || defaultChainId)
  const addresses = useMemo(() => markets.map((m) => m.collateralAsset).filter(Boolean), [markets]);
  const loanAddresses = useMemo(() => markets.map((m) => m.loanAsset).filter(Boolean), [markets]);

  // Use most common chainId among markets (or default)
  const effectiveChainId = useMemo(() => {
    if (markets.length === 0) return defaultChainId;
    const counts = new Map<number, number>();
    for (const m of markets) {
      const id = m.chainId ?? defaultChainId;
      if (!id) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    let best: number | undefined = defaultChainId;
    let max = -1;
    for (const [id, c] of counts) {
      if (c > max) {
        max = c;
        best = id;
      }
    }
    return best;
  }, [markets, defaultChainId]);

  const batchCollateral = useBatchTokenMetadata(addresses, effectiveChainId);
  const batchLoan = useBatchTokenMetadata(loanAddresses, effectiveChainId);

  const enriched: EnrichedMarket[] = useMemo(() => {
    return markets.map((market) => {
      const collMeta = batchCollateral.data.get(market.collateralAsset.toLowerCase());
      const loanMeta = batchLoan.data.get((market.loanAsset || '').toLowerCase());
      const loanAssetSymbol = loanMeta?.symbol || (market.loanAsset ? market.loanAsset.slice(0, 6).toUpperCase() : null);

      const identity = resolveAssetIdentity({
        market,
        tokenSymbol: collMeta?.symbol || null,
        tokenName: collMeta?.name || null,
        tokenLogoUri: collMeta?.logoUri || null,
        loanAssetSymbol,
      });

      return {
        market,
        identity,
        oracleLabel: getOracleLabel(market),
        loanAssetSymbol,
      };
    });
  }, [markets, batchCollateral.data, batchLoan.data]);

  return {
    enriched,
    isLoading: batchCollateral.isLoading || batchLoan.isLoading,
  };
}
