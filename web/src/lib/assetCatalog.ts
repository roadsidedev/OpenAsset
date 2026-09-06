/**
 * @file assetCatalog.ts
 * @description Merged, searchable collateral catalog for the asset-first market
 * creation flow. Merges B20 tokenized stocks, Robinhood stock tokens, curated
 * ERC20s and NFT collections across all supported chains, and resolves the
 * asset adapter that handles each asset on its native chain.
 *
 * Backend-enriched results (fetchSupportedAssetsForAdapter / fetchProviderAssets)
 * remain the primary source at fetch time; this module provides the instant,
 * zero-latency core the search UI renders first.
 */

import { getContracts, type ChainContracts } from './contracts';
import { B20_TOKENS } from './b20';
import { getBrandLogoUrl } from './brandLogos';

export type AssetSource = 'b20' | 'robinhood' | 'erc20' | 'nft' | 'custom';

export interface CatalogAsset {
  address: string;
  symbol: string;
  name: string;
  chainId: number;
  decimals: number;
  source: AssetSource;
  logoUri?: string | null;
  feed?: string;
  requiresAllowlist?: boolean;
  /** Adapter address that handles this asset on its native chain. */
  assetAdapter?: string;
}

export const ASSET_SOURCE_LABELS: Record<AssetSource, string> = {
  b20: 'Tokenized Stock',
  robinhood: 'Robinhood Stock',
  erc20: 'Token',
  nft: 'NFT Collection',
  custom: 'Custom',
};

/** Asset adapter resolution per source, per chain (0x0 = not deployed). */
export function getAssetAdapterForSource(
  source: AssetSource,
  contracts: ChainContracts | undefined,
): string | undefined {
  if (!contracts) return undefined;
  const zero = '0x0000000000000000000000000000000000000000';
  const pick = (addr: string | undefined) => (addr && addr !== zero ? addr : undefined);
  switch (source) {
    case 'b20':
      return pick(contracts.b20AssetAdapter);
    case 'robinhood':
    case 'erc20':
      return pick(contracts.erc20Adapter);
    case 'nft':
      return pick(contracts.erc721Adapter);
    default:
      return undefined;
  }
}

const CURATED_ERC20: Array<{ address: string; symbol: string; name: string; decimals: number; chainIds: number[] }> = [
  {
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainIds: [8453, 84532, 11155111, 46630],
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    chainIds: [8453, 84532],
  },
  {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainIds: [11155111],
  },
  {
    address: '0xd401d6A4f562DEC523eA86a35B2b8E05b5d69B43',
    symbol: 'TEST',
    name: 'Test Token',
    decimals: 18,
    chainIds: [84532],
  },
  {
    address: '0xA58C61370e0f7c419379ac7C27554E1e4de3e940',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainIds: [46630],
  },
];

/**
 * Builds the full cross-chain catalog. Every entry carries its native chainId
 * plus the resolved adapter on that chain, so the UI can show availability and
 * trigger chain switching on selection.
 */
export function buildAssetCatalog(): CatalogAsset[] {
  const assets: CatalogAsset[] = [];

  // B20 tokenized stocks — Base mainnet only (canonical production assets).
  for (const token of Object.values(B20_TOKENS)) {
    const contracts = getContracts(8453);
    assets.push({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      chainId: 8453,
      decimals: 8,
      source: 'b20',
      logoUri: getBrandLogoUrl(token.symbol.replace(/c$/, '')),
      feed: token.feed,
      requiresAllowlist: true,
      assetAdapter: getAssetAdapterForSource('b20', contracts),
    });
  }

  // Robinhood stock tokens.
  // Mainnet entry is reference-only (no factory deployed yet — surfaces as
  // "coming soon" in the picker). Testnet mock is the selectable one.
  assets.push({
    address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
    symbol: 'AAPL',
    name: 'Apple · Robinhood Stock Token',
    chainId: 4663,
    decimals: 18,
    source: 'robinhood',
    logoUri: getBrandLogoUrl('AAPL'),
    feed: '0x6B22A786bAa607d76728168703a39Ea9C99f2cD0',
    requiresAllowlist: true,
    assetAdapter: getAssetAdapterForSource('robinhood', getContracts(4663)),
  });
  assets.push({
    address:
      process.env.NEXT_PUBLIC_ROBINHOOD_AAPL_ADDRESS_46630 ||
      '0xAf6D6d1F38d50d5C5C8219Be2938774a64E1f948',
    symbol: 'AAPL',
    name: 'Apple · Robinhood Stock Token (testnet)',
    chainId: 46630,
    decimals: 18,
    source: 'robinhood',
    logoUri: getBrandLogoUrl('AAPL'),
    feed:
      process.env.NEXT_PUBLIC_ROBINHOOD_AAPL_FEED_46630 ||
      '0x43a7feb2cfa522000228374cad606b5673C4dAF1',
    requiresAllowlist: true,
    assetAdapter: getAssetAdapterForSource('robinhood', getContracts(46630)),
  });

  // Curated ERC20s per chain.
  for (const t of CURATED_ERC20) {
    for (const chainId of t.chainIds) {
      assets.push({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        chainId,
        decimals: t.decimals,
        source: 'erc20',
        logoUri: getBrandLogoUrl(t.symbol),
        assetAdapter: getAssetAdapterForSource('erc20', getContracts(chainId)),
      });
    }
  }

  return assets;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

/** True when a market factory is deployed on the chain (creation supported). */
export function isChainDeployable(chainId: number): boolean {
  const contracts = getContracts(chainId);
  const factory = contracts?.marketFactory;
  return !!factory && factory !== ZERO_ADDR;
}

/** True when the catalog asset can actually be used (adapter deployed). */
export function isAssetDeployable(asset: Pick<CatalogAsset, 'assetAdapter' | 'chainId'>): boolean {
  return !!asset.assetAdapter && asset.assetAdapter !== ZERO_ADDR && isChainDeployable(asset.chainId);
}

/** Deduped list of chains present in the catalog that have a factory deployed. */
export function catalogChainSummaries(): Array<{ chainId: number; count: number }> {
  const byChain = new Map<number, number>();
  for (const a of buildAssetCatalog()) {
    byChain.set(a.chainId, (byChain.get(a.chainId) ?? 0) + 1);
  }
  return [...byChain.entries()]
    .map(([chainId, count]) => ({ chainId, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Search + rank. Ranking: exact symbol > symbol prefix > substring
 * (symbol/name/address); provider assets (stocks) outrank generic ERC20s on
 * ties. Stable, deterministic ordering.
 */
export function searchAssetCatalog(catalog: CatalogAsset[], query: string): CatalogAsset[] {
  const q = query.trim().toLowerCase();
  if (!q) return rankAll(catalog);

  const scored = catalog
    .map((a) => {
      const symbol = a.symbol.toLowerCase();
      const name = a.name.toLowerCase();
      const address = a.address.toLowerCase();
      let score = -1;
      if (symbol === q) score = 100;
      else if (symbol.startsWith(q)) score = 80;
      else if (symbol.includes(q)) score = 60;
      else if (name.startsWith(q)) score = 50;
      else if (name.includes(q)) score = 40;
      else if (address.startsWith(q)) score = 30;
      else if (address.includes(q)) score = 20;
      return { asset: a, score };
    })
    .filter((s) => s.score > 0);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aProvider = a.asset.source === 'b20' || a.asset.source === 'robinhood' ? 1 : 0;
    const bProvider = b.asset.source === 'b20' || b.asset.source === 'robinhood' ? 1 : 0;
    if (bProvider !== aProvider) return bProvider - aProvider;
    return a.asset.symbol.localeCompare(b.asset.symbol);
  });

  return scored.map((s) => s.asset);
}

function rankAll(catalog: CatalogAsset[]): CatalogAsset[] {
  const providerWeight = (s: AssetSource) => (s === 'b20' ? 2 : s === 'robinhood' ? 1 : 0);
  return [...catalog].sort((a, b) => {
    const w = providerWeight(b.source) - providerWeight(a.source);
    if (w !== 0) return w;
    return a.symbol.localeCompare(b.symbol);
  });
}

/** Look up a catalog asset by address on any chain. */
export function findCatalogAsset(catalog: CatalogAsset[], address: string | undefined): CatalogAsset | undefined {
  if (!address) return undefined;
  const normalized = address.toLowerCase();
  return catalog.find((a) => a.address.toLowerCase() === normalized);
}

/**
 * Sync preview list for an asset adapter card (first N supported assets).
 * Provider adapters surface their stock catalogs; ERC20 surfaces curated
 * stablecoins/wrapped assets; NFT adapter intentionally returns [] — the card
 * shows "any ERC-721 collection" instead of a fake list.
 */
export function getAdapterPreviewAssets(adapterAddress: string | undefined, chainId: number, limit = 6): CatalogAsset[] {
  if (!adapterAddress) return [];
  const normalized = adapterAddress.toLowerCase();
  const contracts = getContracts(chainId);
  if (!contracts) return [];

  const isB20 = contracts.b20AssetAdapter?.toLowerCase() === normalized;
  const isERC20 = contracts.erc20Adapter?.toLowerCase() === normalized;
  const isERC721 = contracts.erc721Adapter?.toLowerCase() === normalized;

  const all = buildAssetCatalog();
  if (isB20 || isERC20) {
    const source: AssetSource = isB20 ? 'b20' : 'erc20';
    return all
      .filter((a) => a.chainId === chainId && a.source === source)
      .slice(0, limit);
  }
  void isERC721;
  return [];
}
