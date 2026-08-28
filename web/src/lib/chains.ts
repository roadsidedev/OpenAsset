/**
 * Unified chain config for market discovery
 * Discovery is chain-agnostic: aggregate across all supported chains.
 */
// @ts-nocheck
import { createPublicClient, http, defineChain } from 'viem';
import { base, baseSepolia, sepolia } from 'viem/chains';

export const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Robinhood Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
});

export const robinhoodChainTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } },
});

export const SUPPORTED_CHAINS = [base, baseSepolia, sepolia, robinhoodChain, robinhoodChainTestnet] as const;
export const SUPPORTED_CHAIN_IDS = SUPPORTED_CHAINS.map((c) => c.id) as unknown as [number, ...number[]];

export const DEFAULT_CHAIN_ID: number = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || baseSepolia.id;

export function getRpcUrlForChain(chainId: number): string | undefined {
  if (chainId === base.id) return process.env.NEXT_PUBLIC_RPC_URL_8453 || 'https://mainnet.base.org';
  if (chainId === baseSepolia.id) return process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL_84532 || 'https://sepolia.base.org';
  if (chainId === sepolia.id) return process.env.NEXT_PUBLIC_RPC_URL_11155111 || 'https://rpc.sepolia.org';
  if (chainId === robinhoodChain.id) return process.env.NEXT_PUBLIC_RPC_URL_4663 || 'https://rpc.mainnet.chain.robinhood.com';
  if (chainId === robinhoodChainTestnet.id) return process.env.NEXT_PUBLIC_RPC_URL_46630 || 'https://rpc.testnet.chain.robinhood.com';
  return undefined;
}

export function createChainClient(chainId: number) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  const rpcUrl = getRpcUrlForChain(chainId);
  if (!chain || !rpcUrl) return null;
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
    batch: { multicall: true },
  });
}

// Preferred order for discovery: default chain first
export function discoveryChainIds(): number[] {
  const ids = [...SUPPORTED_CHAIN_IDS];
  const idx = ids.indexOf(DEFAULT_CHAIN_ID);
  if (idx > 0) {
    ids.splice(idx, 1);
    ids.unshift(DEFAULT_CHAIN_ID);
  }
  return ids;
}
