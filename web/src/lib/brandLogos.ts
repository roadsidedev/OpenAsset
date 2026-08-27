'use client';

/**
 * @file brandLogos.ts
 * @description Resolve brand logos for stock tickers / token symbols.
 * Maps B20 tokenized equity symbols (AAPLc etc) and generic tickers
 * to brand domain logos via Clearbit + fallbacks. Used across MarketCard,
 * SupportedAssetGrid, TokenPreview and anywhere assets are displayed.
 */

// Primary mapping: stripped ticker -> { domain, name }
const BRAND_MAP: Record<string, { domain: string; name: string }> = {
  AAPL: { domain: 'apple.com', name: 'Apple' },
  AMZN: { domain: 'amazon.com', name: 'Amazon' },
  COIN: { domain: 'coinbase.com', name: 'Coinbase' },
  CRCL: { domain: 'circle.com', name: 'Circle' },
  GOOGL: { domain: 'abc.xyz', name: 'Alphabet' },
  GOOG: { domain: 'abc.xyz', name: 'Alphabet' },
  INTC: { domain: 'intel.com', name: 'Intel' },
  META: { domain: 'meta.com', name: 'Meta' },
  MSFT: { domain: 'microsoft.com', name: 'Microsoft' },
  MSTR: { domain: 'strategy.com', name: 'Strategy' },
  NVDA: { domain: 'nvidia.com', name: 'NVIDIA' },
  SNDK: { domain: 'sandisk.com', name: 'SanDisk' },
  SPCX: { domain: 'spacex.com', name: 'SpaceX' },
  SPACEX: { domain: 'spacex.com', name: 'SpaceX' },
  'SPACE X': { domain: 'spacex.com', name: 'SpaceX' },
  'SPACE-X': { domain: 'spacex.com', name: 'SpaceX' },
  TSLA: { domain: 'tesla.com', name: 'Tesla' },
  // Aliases
  BRK: { domain: 'berkshirehathaway.com', name: 'Berkshire Hathaway' },
};

// Known crypto overrides (fallback to CoinGecko CDN if brand map misses)
const CRYPTO_LOGOS: Record<string, string> = {
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  DAI: 'https://assets.coingecko.com/coins/images/9956/small/4943.png',
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
};

// Trust Wallet assets repo — chain-agnostic generic fallback for any ERC20 symbol
// Pattern: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/<checksum>/logo.png
// For frontend we use symbol-based heuristic: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/<lower-symbol>/logo.png
// plus direct token-asset search via CoinGecko is already handled in tokenMetadata logoUri. This is pure fallback.
function getTrustWalletFallbackUrl(symbol: string): string | null {
  if (!symbol) return null;
  const clean = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 2 || clean.length > 10) return null;
  // Trust Wallet uses checksum address paths; symbol path is not deterministic.
  // We use the community-maintained generic CDN that mirrors by symbol via api: trustwallet/assets
  // Fallback to simple lowercase symbol path attempt; caller should handle 404 → generic icon.
  // Use placeholder that 404s cleanly so TokenIcon falls back to letter avatar.
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${clean.toLowerCase()}/logo.png`;
}

function normalizeSymbol(symbol: string): string {
  if (!symbol) return '';
  // Trim, upper, strip B20 trailing 'c'/'C' if symbol length >3 and ends with c and maps
  let s = symbol.trim().toUpperCase();
  // Handle B20 suffix: e.g. AAPLC -> AAPL, INTCC -> INTC
  if (s.endsWith('C') && s.length > 2) {
    const stripped = s.slice(0, -1);
    if (BRAND_MAP[stripped] || stripped.length <= 5) {
      // Only strip if stripped is known brand or short ticker-like
      // Check crypto: USDC should not become USD
      const isCrypto = CRYPTO_LOGOS[s] !== undefined;
      if (!isCrypto) s = stripped;
    }
  }
  // Normalize spaces
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Returns a logo URL for a given symbol, or null if none found.
 * Priority:
 * 1. Known crypto logos
 * 2. Brand map via Clearbit
 * 3. Generic Clearbit guess (ticker as domain fallback) — not used, returns null
 */
export function getBrandLogoUrl(symbol: string): string | null {
  if (!symbol) return null;
  const normalized = normalizeSymbol(symbol);
  if (CRYPTO_LOGOS[normalized]) return CRYPTO_LOGOS[normalized];
  if (BRAND_MAP[normalized]) {
    const domain = BRAND_MAP[normalized].domain;
    // Clearbit logo API — reliable, returns png, handles size
    return `https://logo.clearbit.com/${domain}`;
  }
  // Try without spaces/dashes for SPACEX
  const compact = normalized.replace(/[^A-Z0-9]/g, '');
  if (BRAND_MAP[compact]) return `https://logo.clearbit.com/${BRAND_MAP[compact].domain}`;
  // Secondary: check if symbol without C maps to crypto
  if (CRYPTO_LOGOS[compact]) return CRYPTO_LOGOS[compact];
  return null;
}

/**
 * Returns favicon fallback via Google S2 (works for any domain)
 */
export function getBrandFaviconUrl(symbol: string, size = 64): string | null {
  const normalized = normalizeSymbol(symbol);
  const entry = BRAND_MAP[normalized] ?? BRAND_MAP[normalized.replace(/[^A-Z0-9]/g, '')];
  if (!entry) return null;
  return `https://www.google.com/s2/favicons?domain=${entry.domain}&sz=${size}`;
}

/**
 * Resolve best logo for a token: prefers provided logoUri, then brand, then crypto, then favicon, then TrustWallet.
 * Priority preserved: 1) explicit logoUri (token list) 2) CoinGecko crypto 3) Clearbit brand 4) Google favicon 5) TrustWallet.
 */
export function resolveTokenLogo(symbol: string, logoUri?: string | null): string | null {
  if (logoUri) return logoUri;
  const brand = getBrandLogoUrl(symbol);
  if (brand) return brand;
  const favicon = getBrandFaviconUrl(symbol);
  if (favicon) return favicon;
  const trust = getTrustWalletFallbackUrl(symbol);
  if (trust) return trust;
  return null;
}

/**
 * Returns prioritized logo candidates for progressive fallback via <img onError>.
 * Caller can try in order until load succeeds.
 */
export function getLogoCandidates(symbol: string, logoUri?: string | null): string[] {
  const candidates: string[] = [];
  if (logoUri) candidates.push(logoUri);
  const brand = getBrandLogoUrl(symbol);
  if (brand) candidates.push(brand);
  const favicon = getBrandFaviconUrl(symbol);
  if (favicon) candidates.push(favicon);
  const trust = getTrustWalletFallbackUrl(symbol);
  if (trust) candidates.push(trust);
  return candidates;
}

export function getBrandName(symbol: string): string | null {
  const normalized = normalizeSymbol(symbol);
  return BRAND_MAP[normalized]?.name ?? BRAND_MAP[normalized.replace(/[^A-Z0-9]/g, '')]?.name ?? null;
}

// For TokenIcon fallback — export list for tests
export const _BRAND_MAP = BRAND_MAP;
export const _CRYPTO_LOGOS = CRYPTO_LOGOS;
