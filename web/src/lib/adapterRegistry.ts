/**
 * @file adapterRegistry.ts
 * @description Frontend metadata map for known deployed adapters.
 *              Provides human-readable names, descriptions, icons, and
 *              version strings. Keyed by "${chainId}:${address}".
 */

import { ADAPTER_TYPES } from './contractAbis';
import { getContracts } from './contracts';

export interface AdapterMetadata {
  name: string;
  description: string;
  icon: string;
  version: string;
  category: string;
  docs?: string;
}

const STANDARD_POSITION_META: AdapterMetadata = {
  name: 'Standard Position',
  description: 'Internal account mapping — no NFT. Lowest gas. Built for liquid ERC-20 markets; the position itself is not a secondary-market token.',
  icon: 'Stamp',
  version: 'v2.0.0',
  category: 'POSITION',
};

const SOULBOUND_POSITION_META: AdapterMetadata = {
  name: 'Soulbound Position (ERC721)',
  description: 'Non-transferable ERC721 loan position tied to the borrower address. Prevents position trading.',
  icon: 'Lock',
  version: 'v2.0.0',
  category: 'POSITION',
};

const TRANSFERABLE_POSITION_META: AdapterMetadata = {
  name: 'Transferable Position (ERC721)',
  description: 'Mints an ERC721 loan position that can be bought, sold, or transferred on secondary markets.',
  icon: 'ArrowsClockwise',
  version: 'v2.0.0',
  category: 'POSITION',
};

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
  [`${BASE_SEPOLIA}:0xb3035966cdf6f595cDB6f43fdA933AEDCE3c443A`.toLowerCase()]: STANDARD_POSITION_META,
  [`${BASE_SEPOLIA}:0x9c4e5AB78DF11d8273Dfa5eB232768765a3394cC`.toLowerCase()]: SOULBOUND_POSITION_META,
  [`${BASE_SEPOLIA}:0xd66C8f9016f12c2A520A3078BC95BC74993CA433`.toLowerCase()]: TRANSFERABLE_POSITION_META,
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
  // ── Base Sepolia B20 (verified 2026-08-24, owner-fix) ──────────────
  [`${BASE_SEPOLIA}:0x9163527519461FCc6b0c2fC0d4b1CF37Cfc54493`.toLowerCase()]: {
    name: 'B20 Asset Adapter',
    description: 'Custodies Base tokenized stocks (B20 precompile) with policy-aware escrow: checks PolicyRegistry isAuthorized for sender/receiver slots, supports scaled balances.',
    icon: 'Coins',
    version: 'v2.1.0',
    category: 'ASSET',
  },
  [`${BASE_SEPOLIA}:0xA133495C0b94bD888740C4eA6883D1e6c7E12A40`.toLowerCase()]: {
    name: 'B20 Policy Compliance',
    description: 'Enforces B20 transfer policies via PolicyRegistry (sender/receiver slots, pid==0 always-allow). Fail-closed.',
    icon: 'Stamp',
    version: 'v2.1.0',
    category: 'COMPLIANCE',
  },
  [`${BASE_SEPOLIA}:0xe235167a3A5264b6e55692cCFDDBAA800CD54AC0`.toLowerCase()]: {
    name: 'Chainlink Equity Feed (B20 TRV)',
    description: '24/5 total-return Chainlink equity feed (8→18 dec, 0.5%/24h, 90000s staleness, sequencer-aware). Blocks TWAP weekends.',
    icon: 'ChartLine',
    version: 'v2.1.0',
    category: 'ORACLE',
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
  [`${SEPOLIA}:0x74a638Ae4b645b7643C662f99094D0B107179532`.toLowerCase()]: STANDARD_POSITION_META,
  [`${SEPOLIA}:0x36ea319F35750deBf03BbedCcC9E5A96E43932eb`.toLowerCase()]: SOULBOUND_POSITION_META,
  [`${SEPOLIA}:0x6BA08AE1203c4960d508F3656365fEc786fC434e`.toLowerCase()]: TRANSFERABLE_POSITION_META,
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

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function isLiveAddress(addr?: string): boolean {
  return !!addr && addr.toLowerCase() !== ZERO_ADDRESS;
}

function getAdapterMetaFromContracts(chainId: number, address: string): AdapterMetadata | undefined {
  const contracts = getContracts(chainId);
  if (!contracts || !isLiveAddress(address)) return undefined;
  const lower = address.toLowerCase();
  if (isLiveAddress(contracts.standardPositionAdapter) && lower === contracts.standardPositionAdapter.toLowerCase()) return STANDARD_POSITION_META;
  if (isLiveAddress(contracts.soulboundPositionAdapter) && lower === contracts.soulboundPositionAdapter.toLowerCase()) return SOULBOUND_POSITION_META;
  if (isLiveAddress(contracts.transferablePositionAdapter) && lower === contracts.transferablePositionAdapter.toLowerCase()) return TRANSFERABLE_POSITION_META;
  if (isLiveAddress(contracts.b20AssetAdapter) && lower === contracts.b20AssetAdapter.toLowerCase()) {
    return {
      name: 'B20 Asset Adapter',
      description: 'Custodies Base tokenized stocks (B20) with policy-aware escrow.',
      icon: 'Coins',
      version: 'v2.1.0',
      category: 'ASSET',
    };
  }
  if (isLiveAddress(contracts.b20PolicyComplianceAdapter) && lower === contracts.b20PolicyComplianceAdapter.toLowerCase()) {
    return {
      name: 'B20 Policy Compliance',
      description: 'Enforces B20 transfer policies via PolicyRegistry. Fail-closed.',
      icon: 'Stamp',
      version: 'v2.1.0',
      category: 'COMPLIANCE',
    };
  }
  if (isLiveAddress(contracts.robinhoodComplianceAdapter) && lower === contracts.robinhoodComplianceAdapter.toLowerCase()) {
    return {
      name: 'Robinhood Allowlist Compliance',
      description: 'Managed allowlist for Robinhood Stock Token markets. External KYC/KYB remains required.',
      icon: 'Stamp',
      version: 'v2.1.0',
      category: 'COMPLIANCE',
    };
  }
  if (isLiveAddress(contracts.chainlinkEquityFeedAdapter) && lower === contracts.chainlinkEquityFeedAdapter.toLowerCase()) {
    return {
      name: 'Chainlink Equity Feed',
      description: 'Chainlink tokenized-equity feed with staleness and sequencer safeguards.',
      icon: 'ChartLine',
      version: 'v2.1.0',
      category: 'ORACLE',
    };
  }
  return undefined;
}

export function getAdapterMeta(chainId: number | undefined, address: string): AdapterMetadata | undefined {
  if (!chainId || !address) return undefined;
  const key = `${chainId}:${address}`.toLowerCase();
  return getAdapterMetaFromContracts(chainId, address) || metadataMap[key];
}

export function getAdapterFallbackName(typeId: number, address: string): string {
  const typeName = ADAPTER_TYPES[typeId] || 'Unknown';
  return `${typeName} Adapter`;
}
