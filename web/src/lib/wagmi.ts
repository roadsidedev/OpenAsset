// @ts-nocheck
import { createConfig, http } from 'wagmi';
import { base, baseSepolia, sepolia } from 'wagmi/chains';
import { getRpcUrlForChain, robinhoodChain, robinhoodChainTestnet } from './chains';

export const supportedChains = [base, baseSepolia, sepolia, robinhoodChain, robinhoodChainTestnet] as const;

export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || baseSepolia.id;

export const config = createConfig({
  chains: supportedChains,
  ssr: true,
  transports: {
    [base.id]: http(getRpcUrlForChain(base.id)),
    [baseSepolia.id]: http(getRpcUrlForChain(baseSepolia.id)),
    [sepolia.id]: http(getRpcUrlForChain(sepolia.id)),
    [robinhoodChain.id]: http(getRpcUrlForChain(robinhoodChain.id)),
    [robinhoodChainTestnet.id]: http(getRpcUrlForChain(robinhoodChainTestnet.id)),
  },
});
