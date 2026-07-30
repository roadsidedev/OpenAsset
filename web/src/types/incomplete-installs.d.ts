/* eslint-disable @typescript-eslint/no-explicit-any */
// Temporary type declarations for packages with incomplete installs.
// Remove this file once a clean `npm install` is run.

declare module 'viem' {
  export function parseUnits(value: string, decimals?: number): bigint;
  export function formatUnits(value: bigint, decimals?: number): string;
  export function parseEther(value: string): bigint;
  export function formatEther(value: bigint): string;
  export function toHex(value: string | number | bigint): `0x${string}`;
  export function isAddress(value: string): boolean;
  export function getAddress(value: string): string;
  export function parseAbi(abis: readonly string[]): any;
  export type Address = `0x${string}`;
  export type Hash = `0x${string}`;
  export const zeroAddress: Address;
  export const zeroHash: Hash;
  const _default: any;
  export default _default;
}

declare module 'viem/accounts' {
  export function privateKeyToAccount(privateKey: `0x${string}`): any;
}

declare module 'viem/chains' {
  export const mainnet: any;
  export const sepolia: any;
  export const base: any;
  export const arbitrum: any;
  export const optimism: any;
  export const polygon: any;
}

declare module 'wagmi' {
  export function useAccount(): { address?: string; isConnected: boolean; chain?: any };
  export function useWalletClient(): { data?: any };
  export function usePublicClient(config?: { chainId?: number }): any;
  export function useSwitchChain(): any;
  export function http(url?: string): any;
  export function createConfig(config: any): any;
  export const WagmiProvider: any;
}

declare module 'wagmi/connectors' {
  export function injected(): any;
}

declare module '@wagmi/core' {
  export function getPublicClient(config: any): any;
  export function getWalletClient(config: any): any;
}

declare module 'viem/utils' {
  export function encodeFunctionData(args: any): any;
  export function decodeFunctionResult(args: any): any;
  export function formatUnits(value: bigint, decimals?: number): string;
  export function parseUnits(value: string, decimals?: number): bigint;
}

declare module '@privy-io/react-auth' {
  export function usePrivy(): any;
  export function useWallets(): any;
  export const PrivyProvider: any;
}

declare module '@privy-io/wagmi' {
  export function WagmiProvider(props: any): JSX.Element;
  export function usePrivy(): any;
}

declare module '@tanstack/react-query' {
  export const QueryClient: any;
  export const QueryClientProvider: any;
  export function useQuery<T = any>(options: any): any;
}
