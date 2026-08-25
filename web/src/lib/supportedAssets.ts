'use client';

import { fetchFromApi } from './api';
import { B20_TOKENS, isB20Token } from './b20';
import { getContracts } from './contracts';

// Re-export for convenience
export { isB20Token } from './b20';

export interface SupportedAsset {
  address: string;
  symbol: string;
  name: string;
  feed?: string;
  decimals: number;
  logoUri?: string | null;
  marketCount: number;
  totalLiquidity: string;
  isB20: boolean;
  extraMetadata?: Record<string, string>;
}

// Curated ERC20 fallback for non-B20 adapters (D: CoinGecko supplement)
const CURATED_ERC20: Record<number, Array<{ address: string; symbol: string; name: string }>> = {
  84532: [
    { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', symbol: 'USDC', name: 'USD Coin' },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether' },
    { address: '0xd401d6A4f562DEC523eA86a35B2b8E05b5d69B43', symbol: 'TEST', name: 'Test Token' },
  ],
  11155111: [
    { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', symbol: 'USDC', name: 'USD Coin' },
    { address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14', symbol: 'WETH', name: 'Wrapped Ether' },
  ],
  8453: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin' },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether' },
  ],
};

// B with A fallback + D enrichment
export async function fetchSupportedAssetsForAdapter(
  adapterAddress: string,
  chainId: number,
  query?: string,
  limit = 50
): Promise<SupportedAsset[]> {
  const q = query ? `&q=${encodeURIComponent(query)}` : '';
  // 1) Try backend B (primary)
  try {
    const res = await fetchFromApi(`/adapters/${adapterAddress}/assets?chainId=${chainId}${q}&limit=${limit}`);
    if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
      return enrichWithLogos(res.data, chainId);
    }
  } catch {
    // fallback to A
  }

  // 2) Fallback A: hardcoded curated
  const curated = getCuratedFallback(adapterAddress, chainId);
  let filtered = curated;
  if (query) {
    const lower = query.toLowerCase();
    filtered = curated.filter(a => a.symbol.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower) || a.address.toLowerCase().includes(lower));
  }
  return enrichWithLogos(filtered.slice(0, limit), chainId);
}

export async function fetchB20Tokens(chainId: number, query?: string): Promise<SupportedAsset[]> {
  try {
    const q = query ? `&q=${encodeURIComponent(query)}` : '';
    const res = await fetchFromApi(`/adapters/tokens?chainId=${chainId}&type=b20${q}&limit=50`);
    if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
      return enrichWithLogos(res.data.map((r: any) => ({
        address: r.address,
        symbol: r.symbol,
        name: r.name,
        feed: r.feed,
        decimals: r.decimals || 18,
        marketCount: 0,
        totalLiquidity: '0',
        isB20: true,
      })), chainId);
    }
  } catch {}
  // Fallback to B20_TOKENS
  const all = Object.values(B20_TOKENS).map(t => ({
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    feed: t.feed,
    decimals: 18,
    marketCount: 0,
    totalLiquidity: '0',
    isB20: true,
  }));
  if (!query) return enrichWithLogos(all, chainId);
  const lower = query.toLowerCase();
  return enrichWithLogos(all.filter(a => a.symbol.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower)), chainId);
}

function getCuratedFallback(adapterAddress: string, chainId: number): SupportedAsset[] {
  const contracts = getContracts(chainId);
  const lower = adapterAddress.toLowerCase();
  const isB20Adapter = contracts?.b20AssetAdapter?.toLowerCase() === lower;
  const isERC20Adapter = contracts?.erc20Adapter?.toLowerCase() === lower;
  if (isB20Adapter) {
    return Object.values(B20_TOKENS).filter(t => {
      // B20 only on 8453/84532; show anyway with badge but filter by chain
      if (chainId !== 8453 && chainId !== 84532) return false;
      return true;
    }).map(t => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      feed: t.feed,
      decimals: 18,
      marketCount: 0,
      totalLiquidity: '0',
      isB20: true,
    }));
  }
  if (isERC20Adapter) {
    const list = CURATED_ERC20[chainId] || CURATED_ERC20[84532];
    return list.map(t => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: 18,
      marketCount: 0,
      totalLiquidity: '0',
      isB20: false,
    }));
  }
  // For other adapters (ERC721 etc), return empty — picker will show manual input only
  return [];
}

// D: enrich via brand logos + token lists — resolves B20 brand logos and ERC20 known logos
async function enrichWithLogos(assets: SupportedAsset[], _chainId: number): Promise<SupportedAsset[]> {
  // Lazy import to avoid circular deps
  const { getBrandLogoUrl } = await import('./brandLogos');
  return assets.map((a) => {
    if (a.logoUri) return a;
    const brandLogo = getBrandLogoUrl(a.symbol);
    if (brandLogo) return { ...a, logoUri: brandLogo };
    return a;
  });
}

// Helper to determine if adapter supports picker (has curated list)
export function adapterSupportsPicker(adapterAddress: string | undefined, chainId?: number): boolean {
  if (!adapterAddress || !chainId) return false;
  const contracts = getContracts(chainId);
  if (!contracts) return false;
  const lower = adapterAddress.toLowerCase();
  return lower === contracts.b20AssetAdapter?.toLowerCase() || lower === contracts.erc20Adapter?.toLowerCase();
}

// Auto-select companion adapters for B20 (suggest stack)
export function getSuggestedAdaptersForB20(chainId: number) {
  const contracts = getContracts(chainId);
  if (!contracts) return null;
  return {
    assetAdapter: contracts.b20AssetAdapter,
    oracleAdapter: contracts.chainlinkEquityFeedAdapter,
    complianceAdapter: contracts.b20PolicyComplianceAdapter,
    liquidationAdapter: contracts.dexSwapLiquidationAdapter,
    positionAdapter: contracts.soulboundPositionAdapter,
  };
}
