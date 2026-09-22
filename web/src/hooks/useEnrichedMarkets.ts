'use client';

import { useMemo } from 'react';
import { useMultiChainTokenMetadata } from './useBatchTokenMetadata';
import { resolveAssetIdentity, type AssetIdentity, getOracleLabel } from '@/lib/assetIdentity';
import { DEFAULT_CHAIN_ID } from '@/lib/chains';
import type { Market } from './useMarkets';

export interface EnrichedMarket {
  market: Market;
  identity: AssetIdentity;
  oracleLabel: string;
  loanAssetSymbol: string | null;
}

/**
 * Display enrichment (token metadata + identity) for a UNIFIED multichain
 * market list. Every address is read on its own market's chain — never on
 * the wallet chain and never on a majority-chain shortcut, which used to
 * return wrong or missing metadata for markets on minority chains.
 */
export function useEnrichedMarkets(markets: Market[], defaultChainId?: number) {
  const fallbackChain = defaultChainId ?? DEFAULT_CHAIN_ID;

  const collateralItems = useMemo(
    () =>
      markets
        .filter((m) => m.collateralAsset)
        .map((m) => ({ chainId: m.chainId ?? fallbackChain, address: m.collateralAsset })),
    [markets, fallbackChain],
  );
  const loanItems = useMemo(
    () =>
      markets
        .filter((m) => m.loanAsset)
        .map((m) => ({ chainId: m.chainId ?? fallbackChain, address: m.loanAsset as string })),
    [markets, fallbackChain],
  );

  const collateralBatch = useMultiChainTokenMetadata(collateralItems);
  const loanBatch = useMultiChainTokenMetadata(loanItems);

  const enriched: EnrichedMarket[] = useMemo(() => {
    return markets.map((market) => {
      const chainId = market.chainId ?? fallbackChain;
      const collKey = market.collateralAsset ? `${chainId}:${market.collateralAsset.toLowerCase()}` : '';
      const loanKey = market.loanAsset ? `${chainId}:${market.loanAsset.toLowerCase()}` : '';
      const collMeta = collKey ? collateralBatch.data.get(collKey) : undefined;
      const loanMeta = loanKey ? loanBatch.data.get(loanKey) : undefined;
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
  }, [markets, collateralBatch.data, loanBatch.data, fallbackChain]);

  return {
    enriched,
    isLoading: collateralBatch.isLoading || loanBatch.isLoading,
  };
}
