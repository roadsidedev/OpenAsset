// @ts-nocheck
import { createConfig, http } from 'wagmi';
import { base, baseSepolia, sepolia } from 'wagmi/chains';
import { robinhoodChain, robinhoodChainTestnet } from './chains';

export const supportedChains = [base, baseSepolia, sepolia, robinhoodChain, robinhoodChainTestnet] as const;

export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || baseSepolia.id;

function fallbackHttp(chainId: number, envUrl: string | undefined, fallback: string) {
  const url = envUrl && envUrl.trim() ? envUrl.trim() : fallback;
  return http(url);
}

export const config = createConfig({
  chains: supportedChains,
  batch: { multicall: true },
  transports: {
    [base.id]: fallbackHttp(base.id, process.env.NEXT_PUBLIC_RPC_URL_8453, 'https://mainnet.base.org'),
    [baseSepolia.id]: fallbackHttp(baseSepolia.id, process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL_84532, 'https://sepolia.base.org'),
    [sepolia.id]: fallbackHttp(sepolia.id, process.env.NEXT_PUBLIC_RPC_URL_11155111, 'https://rpc.sepolia.org'),
    [robinhoodChain.id]: fallbackHttp(robinhoodChain.id, process.env.NEXT_PUBLIC_RPC_URL_4663, 'https://rpc.mainnet.chain.robinhood.com'),
    [robinhoodChainTestnet.id]: fallbackHttp(robinhoodChainTestnet.id, process.env.NEXT_PUBLIC_RPC_URL_46630, 'https://rpc.testnet.chain.robinhood.com'),
  },
});
