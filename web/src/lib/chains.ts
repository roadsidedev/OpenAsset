/**
 * Unified chain config for market discovery
 * Discovery is chain-agnostic: aggregate across all supported chains.
 */
// @ts-nocheck
import { createPublicClient, http } from 'viem';
import { base, baseSepolia, sepolia } from 'viem/chains';

export const SUPPORTED_CHAINS = [base, baseSepolia, sepolia] as const;
export const SUPPORTED_CHAIN_IDS = SUPPORTED_CHAINS.map((c) => c.id) as unknown as [number, ...number[]];

export const DEFAULT_CHAIN_ID: number = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || baseSepolia.id;

export function getRpcUrlForChain(chainId: number): string | undefined {
  if (chainId === base.id) return process.env.NEXT_PUBLIC_RPC_URL_8453;
  if (chainId === baseSepolia.id) return process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL_84532 || 'https://sepolia.base.org';
  if (chainId === sepolia.id) return process.env.NEXT_PUBLIC_RPC_URL_11155111;
  return undefined;
}

export function createChainClient(chainId: number) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (!chain) return null;
  const rpcUrl = getRpcUrlForChain(chainId);
  return createPublicClient({
    chain,
    transport: rpcUrl ? http(rpcUrl) : http(),
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
