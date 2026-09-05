'use client';

/**
 * @file assetIdentity.ts
 * @description Brand-agnostic asset identity resolver.
 * Derives display symbol, name, category, issuer, logo strictly from on-chain/token source.
 * No hardcoded Ondo/Base/Robinhood naming — adapts to whatever adapter token provides.
 * Category derives solely from assetAdapter type (per user requirement).
 */

import { isB20Token, getB20Info } from './b20';
import { getBrandLogoUrl, getBrandName, resolveTokenLogo } from './brandLogos';
import { getContracts } from './contracts';
import type { Market } from '@/hooks/useMarkets';

export type AssetCategory = 'RWA' | 'Tokenized Equities' | 'Tokens' | 'NFT';

export interface AssetIdentity {
  /** Raw symbol from token (e.g. NVDAc, USDC, PEPE) */
  symbol: string;
  /** Display ticker shown on card — same as symbol but trimmed */
  displaySymbol: string;
  /** Full name e.g. NVIDIA, USD Coin, Pepe */
  name: string;
  /** Issuer/brand name if known e.g. NVIDIA, Circle */
  issuer: string | null;
  /** Resolved logo URL or null */
  logoUri: string | null;
  /** Category derived from adapter type */
  category: AssetCategory;
  /** Category pill label shown on card */
  categoryLabel: string;
  /** True if B20 tokenized stock */
  isB20: boolean;
  /** Collateral address */
  address: string;
  /** Loan asset symbol short e.g. USDC */
  loanAssetSymbol?: string;
  /** Adapter address that determined category */
  adapterAddress?: string;
}

function adapterCategoryForAddress(adapterAddress: string | undefined, chainId: number | undefined): AssetCategory {
  if (!adapterAddress || !chainId) return 'Tokens';
  const contracts = getContracts(chainId);
  if (!contracts) return 'Tokens';
  const lower = adapterAddress.toLowerCase();
  // B20 asset adapter → Tokenized Equities (even though on-chain it's an ERC20 precompile, treat as equities)
  if (contracts.b20AssetAdapter && lower === contracts.b20AssetAdapter.toLowerCase()) return 'Tokenized Equities';
  if (contracts.erc20Adapter && lower === contracts.erc20Adapter.toLowerCase()) return 'Tokens';
  if (contracts.erc721Adapter && lower === contracts.erc721Adapter.toLowerCase()) return 'NFT';
  // Fallback: any other adapter defaults to Tokens (RWA is a separate adapter family not yet in contracts.ts,
  // but when added it should map to RWA). Keep generic.
  return 'Tokens';
}

function shortenAddress(addr: string): string {
  if (!addr || !addr.startsWith('0x')) return addr || '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function resolveAssetIdentity(params: {
  market: Market;
  tokenSymbol?: string | null;
  tokenName?: string | null;
  tokenLogoUri?: string | null;
  loanAssetSymbol?: string | null;
}): AssetIdentity {
  const { market, tokenSymbol, tokenName, tokenLogoUri, loanAssetSymbol } = params;
  const collateral = market.collateralAsset || '';
  const chainId = market.chainId;
  const isB20 = isB20Token(collateral, chainId);
  const b20 = isB20 ? getB20Info(collateral, chainId) : undefined;

  // Symbol/name priority: token on-chain → B20 registry → brand fallback → address slice
  let symbol = '';
  let name = '';
  let logoUri: string | null = null;

  if (tokenSymbol) {
    symbol = tokenSymbol.trim();
    name = (tokenName || '').trim();
    logoUri = tokenLogoUri || null;
  } else if (b20) {
    symbol = b20.symbol;
    name = b20.name;
  } else if (collateral) {
    symbol = shortenAddress(collateral).toUpperCase();
    name = 'Unknown Asset';
  } else {
    // No collateral yet (fallback market with empty address) — show market address as placeholder
    symbol = market.marketAddress.slice(2, 6).toUpperCase();
    name = 'Unknown Asset';
  }

  // If tokenSymbol is generic truncated address, prefer B20 symbol/name
  if (b20 && (!tokenSymbol || tokenSymbol.startsWith('0x') || tokenSymbol.length > 10 || tokenSymbol === symbol)) {
    if (!tokenSymbol || tokenSymbol.toUpperCase() === shortenAddress(collateral).toUpperCase()) {
      symbol = b20.symbol;
      name = b20.name;
    }
  }

  const displaySymbol = symbol;
  // Issuer: derive brand name from symbol via brandLogos (agnostic — works for any known ticker)
  const issuer = getBrandName(symbol) || (b20 ? getBrandName(b20.symbol) : null);

  // Logo resolution: tokenLogoUri (token list) → B20 brand logo → resolved token logo by symbol → favicon fallback
  const effectiveLogo = logoUri || (b20 ? resolveTokenLogo(b20.symbol, null) : null);
  const resolvedLogo = effectiveLogo || resolveTokenLogo(symbol, null);

  // Category strictly from adapter type
  const category = adapterCategoryForAddress(market.assetAdapter, market.chainId);
  // Special case: B20 adapter returns Tokenized Equities; if market has B20 collateral but adapter not yet mapped (old DB), still honor
  const finalCategory: AssetCategory = isB20 && category === 'Tokens' ? 'Tokenized Equities' : category;

  const categoryLabel = finalCategory;

  return {
    symbol,
    displaySymbol,
    name: name || symbol,
    issuer,
    logoUri: resolvedLogo,
    category: finalCategory,
    categoryLabel,
    isB20,
    address: collateral,
    loanAssetSymbol: loanAssetSymbol || undefined,
    adapterAddress: market.assetAdapter,
  };
}

/** Helper for filtering/search — returns searchable tokens */
export function assetSearchHaystack(identity: AssetIdentity, market: Market): string {
  const parts = [
    identity.displaySymbol,
    identity.symbol,
    identity.name,
    identity.issuer || '',
    identity.address,
    identity.category,
    identity.loanAssetSymbol || '',
    market.marketAddress,
    market.loanAsset || '',
  ];
  return parts.join(' ').toLowerCase();
}

/** Price source label (deferred live feed, static label only) */
export function getOracleLabel(market: Market): string {
  if (!market.oracleAdapter) return '—';
  const chainId = market.chainId;
  if (!chainId) return 'On-chain';
  const contracts = getContracts(chainId);
  if (!contracts) return 'On-chain';
  const lower = market.oracleAdapter.toLowerCase();
  if (contracts.chainlinkEquityFeedAdapter && lower === contracts.chainlinkEquityFeedAdapter.toLowerCase()) return 'Chainlink TRV';
  if (contracts.chainlinkAdapter && lower === contracts.chainlinkAdapter.toLowerCase()) return 'Chainlink';
  if (contracts.uniswapV3TWAPAdapter && lower === contracts.uniswapV3TWAPAdapter.toLowerCase()) return 'Uniswap TWAP';
  return 'Oracle';
}
