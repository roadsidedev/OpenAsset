// @ts-nocheck
/**
 * @file wagmi.ts
 * @description wagmi config factory.
 *
 * CRITICAL: `createConfig` MUST come from '@privy-io/wagmi', not 'wagmi'.
 * The Privy variant is a drop-in replacement that installs the Privy connector
 * and keeps wagmi's connector state in sync with Privy auth. Using the generic
 * wagmi `createConfig` leaves embedded-wallet users authenticated in Privy but
 * disconnected in wagmi — so `useSwitchChain` has no Privy connector, chain
 * switches no-op (toast says success, chain never changes), and every CTA
 * falls back to "Sign in / Connect".
 */
import { createConfig } from '@privy-io/wagmi';
import { createConfig as createWagmiConfigBase } from 'wagmi';
import { http } from 'wagmi';
import { base, baseSepolia, sepolia } from 'wagmi/chains';
import { robinhoodChain, robinhoodChainTestnet } from './chains';

export const supportedChains = [base, baseSepolia, sepolia, robinhoodChain, robinhoodChainTestnet] as const;

export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || baseSepolia.id;

function fallbackHttp(chainId: number, envUrl: string | undefined, fallback: string) {
  const url = envUrl && envUrl.trim() ? envUrl.trim() : fallback;
  return http(url);
}

const wagmiArgs = {
  chains: supportedChains,
  batch: { multicall: true },
  transports: {
    [base.id]: fallbackHttp(base.id, process.env.NEXT_PUBLIC_RPC_URL_8453, 'https://mainnet.base.org'),
    [baseSepolia.id]: fallbackHttp(baseSepolia.id, process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL_84532, 'https://sepolia.base.org'),
    [sepolia.id]: fallbackHttp(sepolia.id, process.env.NEXT_PUBLIC_RPC_URL_11155111, 'https://rpc.sepolia.org'),
    [robinhoodChain.id]: fallbackHttp(robinhoodChain.id, process.env.NEXT_PUBLIC_RPC_URL_4663, 'https://rpc.mainnet.chain.robinhood.com'),
    [robinhoodChainTestnet.id]: fallbackHttp(robinhoodChainTestnet.id, process.env.NEXT_PUBLIC_RPC_URL_46630, 'https://rpc.testnet.chain.robinhood.com'),
  },
};

/**
 * Privy-aware config — use with `WagmiProvider` from '@privy-io/wagmi' inside
 * the Privy tree. Installs the `io.privy.wallet` connector.
 */
export const config = createConfig(wagmiArgs);

/**
 * Plain-wagmi fallback for the no-Privy-App-ID path (local dev without auth).
 * Identical chains/transports, no Privy connector.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const baseConfig = createWagmiConfigBase(wagmiArgs as any);
