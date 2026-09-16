/**
 * Supported stablecoins for the lending-asset (LP) side of markets.
 *
 * Addresses verified against Paxos docs (USDG), Circle/CoinGecko (USDC),
 * and canonical USDT deployments. The factory's Rule-1 allowlist
 * (`isAllowedLendingAsset`) remains the source of truth — the UI marks
 * options that fail the on-chain allowlist check as disabled.
 */

export interface StablecoinOption {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  note?: string;
}

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const USDT_BASE = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const USDG_ROBINHOOD = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const USDG_ROBINHOOD_TESTNET = '0x7E955252E15c84f5768B83c41a71F9eba181802F';

const USDT_NAME = 'Tether USD';
const USDG_NAME = 'Global Dollar';

export const SUPPORTED_STABLECOINS: Record<number, StablecoinOption[]> = {
  // Base mainnet: USDC (canonical) + USDT. USDG is not deployed on Base (Paxos docs).
  8453: [
    { symbol: 'USDC', name: 'USD Coin', address: USDC_BASE, decimals: 6, note: 'Recommended' },
    { symbol: 'USDT', name: USDT_NAME, address: USDT_BASE, decimals: 6 },
  ],
  // Base Sepolia: Circle testnet USDC only (no USDT/USDG testnet deployments)
  84532: [{ symbol: 'USDC', name: 'USD Coin (Testnet)', address: USDC_BASE_SEPOLIA, decimals: 6 }],
  // Ethereum Sepolia: Circle testnet USDC only
  11155111: [{ symbol: 'USDC', name: 'USD Coin (Testnet)', address: USDC_SEPOLIA, decimals: 6 }],
  // Robinhood mainnet: USDG is the network's cash leg
  4663: [
    { symbol: 'USDG', name: USDG_NAME, address: USDG_ROBINHOOD, decimals: 6, note: 'Recommended' },
  ],
  // Robinhood testnet: USDG testnet + repo's USDC mock
  46630: [
    { symbol: 'USDG', name: `${USDG_NAME} (Testnet)`, address: USDG_ROBINHOOD_TESTNET, decimals: 6, note: 'Recommended' },
  ],
};

export function getSupportedStablecoins(chainId: number | undefined): StablecoinOption[] {
  if (!chainId) return [];
  return SUPPORTED_STABLECOINS[chainId] || [];
}

export function findStablecoin(chainId: number | undefined, address: string | undefined): StablecoinOption | undefined {
  if (!chainId || !address) return undefined;
  const lower = address.toLowerCase();
  return getSupportedStablecoins(chainId).find((s) => s.address.toLowerCase() === lower);
}
