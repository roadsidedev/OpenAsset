/**
 * @file adapterRegistry.ts
 * @description Frontend metadata for known deployed adapters.
 *
 * The map is GENERATED from contracts.ts (the same source of truth the rest
 * of the app reads), never hardcoded per-address. A hardcoded map rots on
 * every redeploy — every entry below resolves through getContracts(chainId),
 * so redeploys update the UI automatically and new chains work with zero
 * frontend changes.
 */

import { ADAPTER_TYPES } from './contractAbis';
import { getContracts, type ChainContracts } from './contracts';

export interface AdapterMetadata {
  name: string;
  description: string;
  icon: string;
  version: string;
  category: string;
  docs?: string;
}

type AdapterCategory = 'ASSET' | 'ORACLE' | 'COMPLIANCE' | 'LIQUIDATION' | 'POSITION';

interface AdapterDef {
  key: keyof ChainContracts;
  category: AdapterCategory;
  name: string;
  description: string;
  icon: string;
  version: string;
}

const ADAPTER_DEFS: AdapterDef[] = [
  {
    key: 'erc20Adapter',
    category: 'ASSET',
    name: 'ERC20 Asset Adapter',
    description: 'Custodies ERC20 tokens in escrow for collateral. Supports standard approve/transferFrom pattern.',
    icon: 'Coins',
    version: 'v2.0.0',
  },
  {
    key: 'erc721Adapter',
    category: 'ASSET',
    name: 'ERC721 Asset Adapter',
    description: 'Escrows NFTs as collateral. Transfers to contract on loan, returns on repay.',
    icon: 'Image',
    version: 'v2.0.0',
  },
  {
    key: 'b20AssetAdapter',
    category: 'ASSET',
    name: 'B20 Asset Adapter',
    description: 'Custodies Base tokenized stocks (B20 precompile) with policy-aware escrow: checks PolicyRegistry isAuthorized for sender/receiver slots, supports scaled balances.',
    icon: 'Coins',
    version: 'v2.1.0',
  },
  {
    key: 'chainlinkAdapter',
    category: 'ORACLE',
    name: 'Chainlink Oracle',
    description: 'Reads price feeds from Chainlink aggregators. Trusted, tamper-resistant, and widely adopted.',
    icon: 'ChartLine',
    version: 'v2.0.0',
  },
  {
    key: 'uniswapV3TWAPAdapter',
    category: 'ORACLE',
    name: 'Uniswap V3 TWAP Oracle',
    description: 'Time-weighted average price from Uniswap V3 pools. Ideal for crypto-native assets with deep liquidity.',
    icon: 'TrendUp',
    version: 'v2.0.0',
  },
  {
    key: 'chainlinkEquityFeedAdapter',
    category: 'ORACLE',
    name: 'Chainlink Equity Feed',
    description: '24/5 total-return Chainlink equity feed (8→18 dec, 0.5%/24h, 90000s staleness, sequencer-aware). Blocks TWAP weekends.',
    icon: 'ChartLine',
    version: 'v2.1.0',
  },
  {
    key: 'b20PolicyComplianceAdapter',
    category: 'COMPLIANCE',
    name: 'B20 Policy Compliance',
    description: 'Enforces B20 transfer policies via PolicyRegistry (sender/receiver slots, pid==0 always-allow). Fail-closed.',
    icon: 'Stamp',
    version: 'v2.1.0',
  },
  {
    key: 'robinhoodComplianceAdapter',
    category: 'COMPLIANCE',
    name: 'Managed Allowlist Compliance (Robinhood)',
    description: 'Managed-allowlist eligibility for Robinhood tokenized equities. Fail-closed: ineligible borrowers cannot originate.',
    icon: 'Stamp',
    version: 'v2.1.0',
  },
  {
    key: 'standardPositionAdapter',
    category: 'POSITION',
    name: 'Standard Position (ERC721)',
    description: 'Mints a transferable NFT representing the loan position. Lowest gas cost option.',
    icon: 'Stamp',
    version: 'v2.0.0',
  },
  {
    key: 'soulboundPositionAdapter',
    category: 'POSITION',
    name: 'Soulbound Position',
    description: 'Non-transferable loan position tied to the borrower address. Prevents position trading.',
    icon: 'Lock',
    version: 'v2.0.0',
  },
  {
    key: 'transferablePositionAdapter',
    category: 'POSITION',
    name: 'Transferable Position',
    description: 'ERC721 loan position that can be freely bought, sold, or transferred on secondary markets.',
    icon: 'ArrowsClockwise',
    version: 'v2.0.0',
  },
  {
    key: 'dexSwapLiquidationAdapter',
    category: 'LIQUIDATION',
    name: 'DEX Swap Liquidation',
    description: 'Liquidates collateral via DEX swap (Uniswap/SushiSwap). Fast execution and gas-efficient.',
    icon: 'Swap',
    version: 'v2.0.0',
  },
  {
    key: 'nftAuctionLiquidationAdapter',
    category: 'LIQUIDATION',
    name: 'NFT Auction Liquidation',
    description: 'Liquidates NFT collateral via on-chain auction. Best for illiquid or unique NFT collections.',
    icon: 'Gavel',
    version: 'v2.0.0',
  },
];

const ZERO = '0x0000000000000000000000000000000000000000';

/** Chain ids the frontend knows how to resolve contracts for. */
const KNOWN_CHAIN_IDS = [8453, 84532, 11155111, 4663, 46630];

function buildMetadataMap(): Record<string, AdapterMetadata> {
  const map: Record<string, AdapterMetadata> = {};
  for (const chainId of KNOWN_CHAIN_IDS) {
    const contracts = getContracts(chainId);
    if (!contracts) continue;
    for (const def of ADAPTER_DEFS) {
      const address = contracts[def.key];
      if (!address || address === ZERO) continue;
      map[`${chainId}:${address}`.toLowerCase()] = {
        name: def.name,
        description: def.description,
        icon: def.icon,
        version: def.version,
        category: def.category,
      };
    }
  }
  return map;
}

let cachedMap: Record<string, AdapterMetadata> | null = null;

function metadataMap(): Record<string, AdapterMetadata> {
  if (!cachedMap) cachedMap = buildMetadataMap();
  return cachedMap;
}

export function getAdapterMeta(chainId: number | undefined, address: string): AdapterMetadata | undefined {
  if (!chainId || !address) return undefined;
  const key = `${chainId}:${address}`.toLowerCase();
  return metadataMap()[key];
}

export interface DeployedAdapter {
  key: keyof ChainContracts;
  address: string;
  type: AdapterCategory;
  name: string;
  description: string;
  icon: string;
  version: string;
}

/**
 * Selectable adapter set for a chain, derived from contracts.ts. Used by the
 * registry page as the "expected deployment" baseline and by wizards as the
 * fallback option list when the on-chain registry is unreachable.
 */
export function getDeployedAdapters(chainId: number | undefined): DeployedAdapter[] {
  if (!chainId) return [];
  const contracts = getContracts(chainId);
  if (!contracts) return [];
  const out: DeployedAdapter[] = [];
  for (const def of ADAPTER_DEFS) {
    const address = contracts[def.key];
    if (!address || address === ZERO) continue;
    out.push({
      key: def.key,
      address,
      type: def.category,
      name: def.name,
      description: def.description,
      icon: def.icon,
      version: def.version,
    });
  }
  return out;
}

export function getAdapterFallbackName(typeId: number, address: string): string {
  const typeName = ADAPTER_TYPES[typeId] || 'Unknown';
  void address;
  return `${typeName} Adapter`;
}
