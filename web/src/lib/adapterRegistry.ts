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
  // ── Base Sepolia (addresses from contracts.ts) ────────────────
  [`${BASE_SEPOLIA}:0x707901FACDEB84db2830f70Ac0e5e0D0Eeb5C664`.toLowerCase()]: {
    name: 'ERC20 Asset Adapter',
    description: 'Custodies ERC20 tokens in escrow for collateral. Supports standard approve/transferFrom pattern.',
    icon: 'Coins',
    version: 'v2.0.0',
    category: 'ASSET',
  },
  [`${BASE_SEPOLIA}:0x46D51374D1C0b4056d7E018734D6f181C4970e87`.toLowerCase()]: {
    name: 'ERC721 Asset Adapter',
    description: 'Escrows NFTs as collateral. Transfers to contract on loan, returns on repay.',
    icon: 'Image',
    version: 'v2.0.0',
    category: 'ASSET',
  },
  [`${BASE_SEPOLIA}:0xFf3E92A3539bAce12DD1901a3D7b8a2bF1d72e46`.toLowerCase()]: {
    name: 'Chainlink Oracle',
    description: 'Reads price feeds from Chainlink aggregators. Trusted, tamper-resistant, and widely adopted.',
    icon: 'ChartLine',
    version: 'v2.0.0',
    category: 'ORACLE',
  },
  [`${BASE_SEPOLIA}:0xC563fd6C2f3D33035aB42e56f15F9f0A7404310E`.toLowerCase()]: {
    name: 'Uniswap V3 TWAP Oracle',
    description: 'Time-weighted average price from Uniswap V3 pools. Ideal for crypto-native assets with deep liquidity.',
    icon: 'TrendUp',
    version: 'v2.0.0',
    category: 'ORACLE',
  },
  [`${BASE_SEPOLIA}:0xb3035966cdf6f595cDB6f43fdA933AEDCE3c443A`.toLowerCase()]: {
    name: 'Standard Position (ERC721)',
    description: 'Mints a transferable NFT representing the loan position. Lowest gas cost option.',
    icon: 'Stamp',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${BASE_SEPOLIA}:0x9c4e5AB78DF11d8273Dfa5eB232768765a3394cC`.toLowerCase()]: {
    name: 'Soulbound Position',
    description: 'Non-transferable loan position tied to the borrower address. Prevents position trading.',
    icon: 'Lock',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${BASE_SEPOLIA}:0xd66C8f9016f12c2A520A3078BC95BC74993CA433`.toLowerCase()]: {
    name: 'Transferable Position',
    description: 'ERC721 loan position that can be freely bought, sold, or transferred on secondary markets.',
    icon: 'ArrowsClockwise',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${BASE_SEPOLIA}:0x569F318CFfd60C3b305aa082050c59f192d4c5F0`.toLowerCase()]: {
    name: 'DEX Swap Liquidation',
    description: 'Liquidates collateral via DEX swap (Uniswap/SushiSwap). Fast execution and gas-efficient.',
    icon: 'Swap',
    version: 'v2.0.0',
    category: 'LIQUIDATION',
  },
  [`${BASE_SEPOLIA}:0x1746cB9aF9F39125cD8f17Eda680Eb8a1161c020`.toLowerCase()]: {
    name: 'NFT Auction Liquidation',
    description: 'Liquidates NFT collateral via on-chain auction. Best for illiquid or unique NFT collections.',
    icon: 'Gavel',
    version: 'v2.0.0',
    category: 'LIQUIDATION',
  },

  // ── Sepolia (addresses from contracts.ts) ─────────────────────
  [`${SEPOLIA}:0x280eB9597d786D44bC3cd9A4522De023Ace7a304`.toLowerCase()]: {
    name: 'ERC20 Asset Adapter',
    description: 'Custodies ERC20 tokens in escrow for collateral. Supports standard approve/transferFrom pattern.',
    icon: 'Coins',
    version: 'v2.0.0',
    category: 'ASSET',
  },
  [`${SEPOLIA}:0x2Fee4997B6A99d7ef25ae136fA5a66408BdC8B33`.toLowerCase()]: {
    name: 'ERC721 Asset Adapter',
    description: 'Escrows NFTs as collateral. Transfers to contract on loan, returns on repay.',
    icon: 'Image',
    version: 'v2.0.0',
    category: 'ASSET',
  },
  [`${SEPOLIA}:0xE5C2c46B5BbB628eC1f53D0A0E5DFf8077dCFD86`.toLowerCase()]: {
    name: 'Chainlink Oracle',
    description: 'Reads price feeds from Chainlink aggregators. Trusted, tamper-resistant, and widely adopted.',
    icon: 'ChartLine',
    version: 'v2.0.0',
    category: 'ORACLE',
  },
  [`${SEPOLIA}:0xc0ddD242bE63ac0951EdE09C80c218b603036d5D`.toLowerCase()]: {
    name: 'Uniswap V3 TWAP Oracle',
    description: 'Time-weighted average price from Uniswap V3 pools. Ideal for crypto-native assets with deep liquidity.',
    icon: 'TrendUp',
    version: 'v2.0.0',
    category: 'ORACLE',
  },
  [`${SEPOLIA}:0x74a638Ae4b645b7643C662f99094D0B107179532`.toLowerCase()]: {
    name: 'Standard Position (ERC721)',
    description: 'Mints a transferable NFT representing the loan position. Lowest gas cost option.',
    icon: 'Stamp',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${SEPOLIA}:0x36ea319F35750deBf03BbedCcC9E5A96E43932eb`.toLowerCase()]: {
    name: 'Soulbound Position',
    description: 'Non-transferable loan position tied to the borrower address. Prevents position trading.',
    icon: 'Lock',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${SEPOLIA}:0x6BA08AE1203c4960d508F3656365fEc786fC434e`.toLowerCase()]: {
    name: 'Transferable Position',
    description: 'ERC721 loan position that can be freely bought, sold, or transferred on secondary markets.',
    icon: 'ArrowsClockwise',
    version: 'v2.0.0',
    category: 'POSITION',
  },
  [`${SEPOLIA}:0x798130284DbA79c7B34b617eFD50b1B2b90d74FA`.toLowerCase()]: {
    name: 'DEX Swap Liquidation',
    description: 'Liquidates collateral via DEX swap (Uniswap/SushiSwap). Fast execution and gas-efficient.',
    icon: 'Swap',
    version: 'v2.0.0',
    category: 'LIQUIDATION',
  },
  [`${SEPOLIA}:0xB528A74EE9Bda90ab3aC407c9c4F69f9Bf716CB5`.toLowerCase()]: {
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
