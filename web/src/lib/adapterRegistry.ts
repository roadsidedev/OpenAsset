/**
 * @file adapterRegistry.ts
 * @description Frontend metadata map for known deployed adapters.
 *              Provides human-readable names, descriptions, icons, and
 *              version strings. Keyed by "${chainId}:${address}".
 */

import { ADAPTER_TYPES } from './contractAbis';

export interface AdapterMetadata {
  name: string;
  description: string;
  icon: string;
  version: string;
  category: string;
  docs?: string;
}

const BASE_SEPOLIA = '84532';
const SEPOLIA = '11155111';

const metadataMap: Record<string, AdapterMetadata> = {
  // ── Base Sepolia ──────────────────────────────────────────────
  [`${BASE_SEPOLIA}:0xB35Ddb2A465344D05EBC7Eb9F6A42995B3075d9B`.toLowerCase()]: {
    name: 'ERC20 Asset Adapter',
    description: 'Custodies ERC20 tokens in escrow for collateral. Supports standard approve/transferFrom pattern.',
    icon: 'Coins',
    version: 'v2.0.0',
    category: 'ASSET',
  },
  [`${BASE_SEPOLIA}:0xa64273c87Ca6845D24670863b832fDc4fb044363`.toLowerCase()]: {
    name: 'ERC721 Asset Adapter',
    description: 'Escrows NFTs as collateral. Transfers to contract on loan, returns on repay.',
    icon: 'Image',
    version: 'v2.0.0',
    category: 'ASSET',
  },
  [`${BASE_SEPOLIA}:0x9f01Fb9928FDfcD5e15E4d607E990FB07DF524CB`.toLowerCase()]: {
    name: 'Chainlink Oracle',
    description: 'Reads price feeds from Chainlink aggregators. Trusted, tamper-resistant, and widely adopted.',
    icon: 'ChartLine',
    version: 'v2.0.0',
    category: 'ORACLE',
  },
  [`${BASE_SEPOLIA}:0x525499534bcd103aD19552079D1d80aD209988Aa`.toLowerCase()]: {
    name: 'Uniswap V3 TWAP Oracle',
    description: 'Time-weighted average price from Uniswap V3 pools. Ideal for crypto-native assets with deep liquidity.',
    icon: 'TrendUp',
    version: 'v2.0.0',
    category: 'ORACLE',
  },
  [`${BASE_SEPOLIA}:0x54bf0b87bA15Ff9cBA95396C295Fc355e4574335`.toLowerCase()]: {
    name: 'Standard Position (ERC721)',
    description: 'Mints a transferable NFT representing the loan position. Lowest gas cost option.',
    icon: 'Stamp',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${BASE_SEPOLIA}:0x001C29355522d3C43378FE3535BC1DB4Ec21B1F6`.toLowerCase()]: {
    name: 'Soulbound Position',
    description: 'Non-transferable loan position tied to the borrower address. Prevents position trading.',
    icon: 'Lock',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${BASE_SEPOLIA}:0x99e208eCE2b4513ef8A893B94709A67b2F26A5BA`.toLowerCase()]: {
    name: 'Transferable Position',
    description: 'ERC721 loan position that can be freely bought, sold, or transferred on secondary markets.',
    icon: 'ArrowsClockwise',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${BASE_SEPOLIA}:0xEC78903A3c72d536B0952A2b77939FbFA1e4e28e`.toLowerCase()]: {
    name: 'DEX Swap Liquidation',
    description: 'Liquidates collateral via DEX swap (Uniswap/SushiSwap). Fast execution and gas-efficient.',
    icon: 'Swap',
    version: 'v2.0.0',
    category: 'LIQUIDATION',
  },
  [`${BASE_SEPOLIA}:0x2497d012A3B95E2d9D4B290d5948771A3eaC6b45`.toLowerCase()]: {
    name: 'NFT Auction Liquidation',
    description: 'Liquidates NFT collateral via on-chain auction. Best for illiquid or unique NFT collections.',
    icon: 'Gavel',
    version: 'v2.0.0',
    category: 'LIQUIDATION',
  },

  // ── Sepolia ───────────────────────────────────────────────────
  [`${SEPOLIA}:0x2296a019079BA10E4430DC8012504d92B5B8A795`.toLowerCase()]: {
    name: 'ERC20 Asset Adapter',
    description: 'Custodies ERC20 tokens in escrow for collateral. Supports standard approve/transferFrom pattern.',
    icon: 'Coins',
    version: 'v2.0.0',
    category: 'ASSET',
  },
  [`${SEPOLIA}:0x590667a3f38300b9D54e5A8c5D2A12767B244949`.toLowerCase()]: {
    name: 'ERC721 Asset Adapter',
    description: 'Escrows NFTs as collateral. Transfers to contract on loan, returns on repay.',
    icon: 'Image',
    version: 'v2.0.0',
    category: 'ASSET',
  },
  [`${SEPOLIA}:0x47518aBb5eDE5e05BcF428c397a0998b68Ed939b`.toLowerCase()]: {
    name: 'Chainlink Oracle',
    description: 'Reads price feeds from Chainlink aggregators. Trusted, tamper-resistant, and widely adopted.',
    icon: 'ChartLine',
    version: 'v2.0.0',
    category: 'ORACLE',
  },
  [`${SEPOLIA}:0x63b60CF11F1833fE8EaC8bC8A7C795159a154d4E`.toLowerCase()]: {
    name: 'Standard Position (ERC721)',
    description: 'Mints a transferable NFT representing the loan position. Lowest gas cost option.',
    icon: 'Stamp',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${SEPOLIA}:0xc0c571b98891163b704A06AE0648A969f47Bf797`.toLowerCase()]: {
    name: 'Soulbound Position',
    description: 'Non-transferable loan position tied to the borrower address. Prevents position trading.',
    icon: 'Lock',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${SEPOLIA}:0xA34C6BC828789ee963B492b9AC68675DA0E1252B`.toLowerCase()]: {
    name: 'Transferable Position',
    description: 'ERC721 loan position that can be freely bought, sold, or transferred on secondary markets.',
    icon: 'ArrowsClockwise',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${SEPOLIA}:0xc9eF65E04Eb1358E24f21a2F31639BB455E846E5`.toLowerCase()]: {
    name: 'DEX Swap Liquidation',
    description: 'Liquidates collateral via DEX swap (Uniswap/SushiSwap). Fast execution and gas-efficient.',
    icon: 'Swap',
    version: 'v2.0.0',
    category: 'LIQUIDATION',
  },
  [`${SEPOLIA}:0x1bb47bB68C33262DB13F0D72181658a97526056e`.toLowerCase()]: {
    name: 'NFT Auction Liquidation',
    description: 'Liquidates NFT collateral via on-chain auction. Best for illiquid or unique NFT collections.',
    icon: 'Gavel',
    version: 'v2.0.0',
    category: 'LIQUIDATION',
  },
};

export function getAdapterMeta(chainId: number | undefined, address: string): AdapterMetadata | undefined {
  if (!chainId || !address) return undefined;
  const key = `${chainId}:${address}`.toLowerCase();
  return metadataMap[key];
}

export function getAdapterFallbackName(typeId: number, address: string): string {
  const typeName = ADAPTER_TYPES[typeId] || 'Unknown';
  return `${typeName} Adapter`;
}
