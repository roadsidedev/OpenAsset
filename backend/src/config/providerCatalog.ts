export type ProviderFamily = 'b20' | 'robinhood';

export interface ProviderAssetManifest {
  providerId: string;
  provider: ProviderFamily;
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  feed?: string;
  requiresAllowlist: boolean;
}

export const PROVIDER_IDS = {
  B20: '0x7e92cb1fe5a16565e61e082ff8f3a269e6c6a38e1737b710a9ceb24f59f92ddf',
  ROBINHOOD: '0xb967c2ab7458c1185507a53267f1540cf3b6b0acf93ff70227e8eb894f5da29d',
} as const;

/**
 * Canonical provider assets pinned from issuer documentation. Keep this list
 * small and verified; unknown symbols must not be inferred from ticker matches.
 */
export const ROBINHOOD_ASSETS: ProviderAssetManifest[] = [
  {
    providerId: PROVIDER_IDS.ROBINHOOD,
    provider: 'robinhood',
    chainId: 4663,
    address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
    symbol: 'AAPL',
    name: 'Apple · Robinhood Stock Token',
    decimals: 18,
    feed: '0x6B22A786bAa607d76728168703a39Ea9C99f2cD0',
    requiresAllowlist: true,
  },
];

export function getProviderAssets(chainId: number, provider: ProviderFamily): ProviderAssetManifest[] {
  if (provider === 'robinhood') return ROBINHOOD_ASSETS.filter((asset) => asset.chainId === chainId);
  return [];
}

export function getProviderAsset(chainId: number, address: string): ProviderAssetManifest | undefined {
  const normalized = address.toLowerCase();
  return [...ROBINHOOD_ASSETS].find(
    (asset) => asset.chainId === chainId && asset.address.toLowerCase() === normalized,
  );
}
