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
  PLTR: { domain: 'palantir.com', name: 'Palantir' },
  SQ: { domain: 'squareup.com', name: 'Block' },
  SHOP: { domain: 'shopify.com', name: 'Shopify' },
  NET: { domain: 'fast.com', name: 'Cloudflare' },
  DASH: { domain: 'dash.org', name: 'Dash' },
  LTC: { domain: 'litecoin.org', name: 'Litecoin' },
  BCH: { domain: 'bitcoincash.org', name: 'Bitcoin Cash' },
  // Aliases
  BRK: { domain: 'berkshirehathaway.com', name: 'Berkshire Hathaway' },
};

// Module-level cache: resolved URLs keyed by symbol → never re-hits network on symbol change.
const resolvedCache = new Map<string, string | null>();
function getCachedOrResolve(symbol: string, resolver: () => string | null): string | null {
  const key = symbol.toUpperCase();
  if (resolvedCache.has(key)) return resolvedCache.get(key) ?? null;
  const result = resolver();
  resolvedCache.set(key, result);
  if (result) {
    try { sessionStorage.setItem(`logo:${key}`, result); } catch { /* noop */ }
  }
  return result;
}

// Known crypto overrides (fallback to CoinGecko CDN if brand map misses)
const CRYPTO_LOGOS: Record<string, string> = {
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  DAI: 'https://assets.coingecko.com/coins/images/9956/small/4943.png',
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  AAVE: 'https://assets.coingecko.com/coins/images/12645/small/aave.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/small/uniswap.png',
  COMP: 'https://assets.coingecko.com/coins/images/10875/small/compound.png',
  MKR: 'https://assets.coingecko.com/coins/images/1364/small/maker.png',
  SNX: 'https://assets.coingecko.com/coins/images/3406/small/synthetix.png',
  CRV: 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
  BAL: 'https://assets.coingecko.com/coins/images/6316/small/Balancer.png',
  SUSHI: 'https://assets.coingecko.com/coins/images/12271/small/sushi.png',
  PEPE: 'https://assets.coingecko.com/coins/images/14261/small/pepe-token.jpeg',
  SHIB: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  RNDR: 'https://assets.coingecko.com/coins/images/2349/small/render.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/arbitrum.png',
  OP: 'https://assets.coingecko.com/coins/images/27944/small/OP.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  POL: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/avalanche.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  DOT: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
  TIA: 'https://assets.coingecko.com/coins/images/27594/small/tia.png',
  INJ: 'https://assets.coingecko.com/coins/images/12886/small/Injective.png',
  SEI: 'https://assets.coingecko.com/coins/images/26374/small/sei.png',
  RUNE: 'https://assets.coingecko.com/coins/images/12495/small/THORChain.png',
  ATOM: 'https://assets.coingecko.com/coins/images/1481/small/cosmos.png',
  OSMO: 'https://assets.coingecko.com/coins/images/23501/small/osmo.png',
  JUP: 'https://assets.coingecko.com/coins/images/29155/small/jupiter.png',
  WIF: 'https://assets.coingecko.com/coins/images/34766/small/dogwifcoin.png',
  BONK: 'https://assets.coingecko.com/coins/images/28774/small/bonk.png',
  HYPE: 'https://assets.coingecko.com/coins/images/34171/small/hyperliquid.png',
  ENA: 'https://assets.coingecko.com/coins/images/34140/small/ena.png',
  RWA: 'https://assets.coingecko.com/coins/images/18867/small/centrifuge.png',
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
  return getCachedOrResolve(symbol, () => {
    if (CRYPTO_LOGOS[normalized]) return CRYPTO_LOGOS[normalized];
    // Google S2 favicon first (more reliable than Clearbit since Dec 2024)
    const entry = BRAND_MAP[normalized] ?? BRAND_MAP[normalized.replace(/[^A-Z0-9]/g, '')];
    if (entry) {
      // Return favicon as primary (most reliable across regions)
      return `https://www.google.com/s2/favicons?domain=${entry.domain}&sz=64`;
    }
    // Try without spaces/dashes for SPACEX
    const compact = normalized.replace(/[^A-Z0-9]/g, '');
    if (BRAND_MAP[compact]) return `https://www.google.com/s2/favicons?domain=${BRAND_MAP[compact].domain}&sz=64`;
    if (CRYPTO_LOGOS[compact]) return CRYPTO_LOGOS[compact];
    return null;
  });
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
 * Resolve best logo for a token. Priority (all cached in-session):
 * 1) explicit logoUri (token list) 2) brand favicon (S2) 3) CoinGecko crypto.
 * TrustWallet symbol-heuristic removed — it 404'd by design and just wasted a
 * network round-trip; the letter avatar is the honest terminal fallback.
 */
export function resolveTokenLogo(symbol: string, logoUri?: string | null): string | null {
  if (logoUri) return logoUri;
  return getBrandLogoUrl(symbol);
}

/**
 * Returns prioritized logo candidates for progressive fallback via <img onError>.
 * Caller can try in order until load succeeds. Never emits a doomed URL.
 */
export function getLogoCandidates(symbol: string, logoUri?: string | null): string[] {
  const candidates: string[] = [];
  if (logoUri) candidates.push(logoUri);
  const brand = getBrandLogoUrl(symbol);
  if (brand) candidates.push(brand);
  const favicon = getBrandFaviconUrl(symbol);
  if (favicon && favicon !== brand) candidates.push(favicon);
  return candidates;
}

export function getBrandName(symbol: string): string | null {
  const normalized = normalizeSymbol(symbol);
  return BRAND_MAP[normalized]?.name ?? BRAND_MAP[normalized.replace(/[^A-Z0-9]/g, '')]?.name ?? null;
}

// For TokenIcon fallback — export list for tests
export const _BRAND_MAP = BRAND_MAP;
export const _CRYPTO_LOGOS = CRYPTO_LOGOS;
