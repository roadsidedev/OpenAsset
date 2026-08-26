// @ts-nocheck
import { createConfig, http } from 'wagmi';
import { base, baseSepolia, sepolia } from 'wagmi/chains';

export const supportedChains = [base, baseSepolia, sepolia] as const;

export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || baseSepolia.id;

export const config = createConfig({
  chains: supportedChains,
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL_8453 || undefined),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL_84532 || 'https://sepolia.base.org'),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL_11155111 || undefined),
  },
});
