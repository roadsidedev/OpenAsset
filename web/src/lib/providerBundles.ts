import { keccak256, toHex } from 'viem';
import { B20_TOKENS } from './b20';

export type ProviderFamily = 'b20' | 'robinhood';
export type ProviderId = `0x${string}`;

export const PROVIDER_IDS: Record<'B20' | 'ROBINHOOD', ProviderId> = {
  B20: keccak256(toHex('OPENASSET_PROVIDER_B20')),
  ROBINHOOD: keccak256(toHex('OPENASSET_PROVIDER_ROBINHOOD')),
};

export interface ProviderAsset {
  providerId: ProviderId;
  provider: ProviderFamily;
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  feed?: string;
  legalLabel: string;
  priceModel: 'chainlink-total-return' | 'chainlink-multiplier-adjusted';
  requiresAllowlist: boolean;
}

export const PROVIDER_CHAIN_CONFIG: Record<ProviderFamily, { chainIds: number[]; sequencerFeeds: Record<number, string | undefined> }> = {
  b20: {
    chainIds: [8453, 84532],
    sequencerFeeds: {
      8453: process.env.NEXT_PUBLIC_BASE_SEQUENCER_FEED_8453,
      84532: process.env.NEXT_PUBLIC_BASE_SEQUENCER_FEED_84532,
    },
  },
  robinhood: {
    chainIds: [4663, 46630],
    sequencerFeeds: {
      4663: process.env.NEXT_PUBLIC_ROBINHOOD_SEQUENCER_FEED_4663,
      46630: process.env.NEXT_PUBLIC_ROBINHOOD_SEQUENCER_FEED_46630,
    },
  },
};

const ROBINHOOD_ASSETS: ProviderAsset[] = [
  {
    providerId: PROVIDER_IDS.ROBINHOOD,
    provider: 'robinhood',
    chainId: 4663,
    address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
    symbol: 'AAPL',
    name: 'Apple · Robinhood Stock Token',
    decimals: 18,
    feed: '0x6B22A786bAa607d76728168703a39Ea9C99f2cD0',
    legalLabel: 'Robinhood tokenized debt security; not direct Apple shares',
    priceModel: 'chainlink-multiplier-adjusted',
    requiresAllowlist: true,
  },
  {
    providerId: PROVIDER_IDS.ROBINHOOD,
    provider: 'robinhood',
    chainId: 46630,
    address: process.env.NEXT_PUBLIC_ROBINHOOD_AAPL_ADDRESS_46630 || '0xAf6D6d1F38d50d5C5C8219Be2938774a64E1f948',
    symbol: 'AAPL',
    name: 'Apple · Robinhood Stock Token (testnet)',
    decimals: 18,
    feed: process.env.NEXT_PUBLIC_ROBINHOOD_AAPL_FEED_46630 || '0x43a7feb2cfa522000228374cad606b5673C4dAF1',
    legalLabel: 'Robinhood tokenized debt security; not direct Apple shares',
    priceModel: 'chainlink-multiplier-adjusted',
    requiresAllowlist: true,
  },
];

const B20_ASSETS: ProviderAsset[] = Object.values(B20_TOKENS).map((asset) => ({
  providerId: PROVIDER_IDS.B20,
  provider: 'b20' as const,
  chainId: 8453,
  address: asset.address,
  symbol: asset.symbol,
  name: asset.name,
  decimals: 8,
  feed: asset.feed,
  legalLabel: 'Coinbase B20 tokenized stock; not direct issuer shares',
  priceModel: 'chainlink-total-return' as const,
  requiresAllowlist: true,
}));

export const PROVIDER_ASSETS: ProviderAsset[] = [...B20_ASSETS, ...ROBINHOOD_ASSETS];

export function getProviderAsset(chainId: number | undefined, address: string | undefined): ProviderAsset | undefined {
  if (!chainId || !address) return undefined;
  const normalized = address.toLowerCase();
  return PROVIDER_ASSETS.find((asset) => asset.chainId === chainId && asset.address.toLowerCase() === normalized);
}

export function getProviderAssetByAddress(address: string | undefined): ProviderAsset | undefined {
  if (!address) return undefined;
  const normalized = address.toLowerCase();
  return PROVIDER_ASSETS.find((asset) => asset.address.toLowerCase() === normalized);
}

export function getProviderAssets(chainId: number | undefined, provider?: ProviderFamily): ProviderAsset[] {
  if (!chainId) return [];
  return PROVIDER_ASSETS.filter((asset) => asset.chainId === chainId && (!provider || asset.provider === provider));
}

export function getProviderSequencerFeed(chainId: number, provider: ProviderFamily): string | undefined {
  const config = PROVIDER_CHAIN_CONFIG[provider];
  if (!config?.chainIds.includes(chainId)) return undefined;
  return config.sequencerFeeds[chainId];
}

export function getProviderLabel(provider: ProviderFamily | undefined): string {
  if (provider === 'b20') return 'Base B20';
  if (provider === 'robinhood') return 'Robinhood Stock Token';
  return 'Provider asset';
}
