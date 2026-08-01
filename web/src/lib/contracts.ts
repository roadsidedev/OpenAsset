/**
 * @file contracts.ts
 * @description Multi-chain contract address resolver for the frontend
 */

export interface ChainContracts {
  marketFactory: string;
  marketDeployer: string;
  adapterRegistry: string;
  erc20Adapter: string;
  erc721Adapter: string;
  chainlinkAdapter: string;
  uniswapV3TWAPAdapter: string;
  standardPositionAdapter: string;
  soulboundPositionAdapter: string;
  transferablePositionAdapter: string;
  dexSwapLiquidationAdapter: string;
  nftAuctionLiquidationAdapter: string;
  usdc: string;
}

const CHAIN_CONFIGS: Record<number, ChainContracts> = {
  // Base Sepolia (84532)
  84532: {
    marketFactory: process.env.NEXT_PUBLIC_MARKET_FACTORY_V2_ADDRESS_84532 || '0xFa615F9b9187399dB68357A3445383E1cbc8a12c',
    marketDeployer: process.env.NEXT_PUBLIC_MARKET_DEPLOYER_ADDRESS_84532 || '0xD5d4FEfA4f6Fb3988f26e9A3582c97E7c12a6470',
    adapterRegistry: process.env.NEXT_PUBLIC_ADAPTER_REGISTRY_ADDRESS_84532 || '0x80f70Da0e0e7A2b9D3A1eE4956309b295329A7D7',
    erc20Adapter: process.env.NEXT_PUBLIC_ERC20_ADAPTER_84532 || '0x707901FACDEB84db2830f70Ac0e5e0D0Eeb5C664',
    erc721Adapter: process.env.NEXT_PUBLIC_ERC721_ADAPTER_84532 || '0x46D51374D1C0b4056d7E018734D6f181C4970e87',
    chainlinkAdapter: process.env.NEXT_PUBLIC_CHAINLINK_ADAPTER_84532 || '0xFf3E92A3539bAce12DD1901a3D7b8a2bF1d72e46',
    uniswapV3TWAPAdapter: process.env.NEXT_PUBLIC_UNISWAP_V3_TWAP_ADAPTER_84532 || '0xC563fd6C2f3D33035aB42e56f15F9f0A7404310E',
    standardPositionAdapter: process.env.NEXT_PUBLIC_STANDARD_POSITION_ADAPTER_84532 || '0xb3035966cdf6f595cDB6f43fdA933AEDCE3c443A',
    soulboundPositionAdapter: process.env.NEXT_PUBLIC_SOULBOUND_POSITION_ADAPTER_84532 || '0x9c4e5AB78DF11d8273Dfa5eB232768765a3394cC',
    transferablePositionAdapter: process.env.NEXT_PUBLIC_TRANSFERABLE_POSITION_ADAPTER_84532 || '0xd66C8f9016f12c2A520A3078BC95BC74993CA433',
    dexSwapLiquidationAdapter: process.env.NEXT_PUBLIC_DEX_SWAP_LIQUIDATION_ADAPTER_84532 || '0x569F318CFfd60C3b305aa082050c59f192d4c5F0',
    nftAuctionLiquidationAdapter: process.env.NEXT_PUBLIC_NFT_AUCTION_LIQUIDATION_ADAPTER_84532 || '0x1746cB9aF9F39125cD8f17Eda680Eb8a1161c020',
    usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_84532 || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  // Sepolia (11155111)
  11155111: {
    marketFactory: process.env.NEXT_PUBLIC_MARKET_FACTORY_V2_ADDRESS_11155111 || '0x95599a74Ae215d8208f7Bb6A8e680B0C58F03c67',
    marketDeployer: process.env.NEXT_PUBLIC_MARKET_DEPLOYER_ADDRESS_11155111 || '0xAEf469a4ab0c51D6fa5b5Fd1368d2e3b85ecC602',
    adapterRegistry: process.env.NEXT_PUBLIC_ADAPTER_REGISTRY_ADDRESS_11155111 || '0x43c4Dd1975B7AEcE2c0b632D2Ff2d8576d31C49F',
    erc20Adapter: process.env.NEXT_PUBLIC_ERC20_ADAPTER_11155111 || '0x2296a019079BA10E4430DC8012504d92B5B8A795',
    erc721Adapter: process.env.NEXT_PUBLIC_ERC721_ADAPTER_11155111 || '0x590667a3f38300b9D54e5A8c5D2A12767B244949',
    chainlinkAdapter: process.env.NEXT_PUBLIC_CHAINLINK_ADAPTER_11155111 || '0x47518aBb5eDE5e05BcF428c397a0998b68Ed939b',
    uniswapV3TWAPAdapter: '',
    standardPositionAdapter: process.env.NEXT_PUBLIC_STANDARD_POSITION_ADAPTER_11155111 || '0x63b60CF11F1833fE8EaC8bC8A7C795159a154d4E',
    soulboundPositionAdapter: process.env.NEXT_PUBLIC_SOULBOUND_POSITION_ADAPTER_11155111 || '0xc0c571b98891163b704A06AE0648A969f47Bf797',
    transferablePositionAdapter: process.env.NEXT_PUBLIC_TRANSFERABLE_POSITION_ADAPTER_11155111 || '0xA34C6BC828789ee963B492b9AC68675DA0E1252B',
    dexSwapLiquidationAdapter: process.env.NEXT_PUBLIC_DEX_SWAP_LIQUIDATION_ADAPTER_11155111 || '0xc9eF65E04Eb1358E24f21a2F31639BB455E846E5',
    nftAuctionLiquidationAdapter: process.env.NEXT_PUBLIC_NFT_AUCTION_LIQUIDATION_ADAPTER_11155111 || '0x1bb47bB68C33262DB13F0D72181658a97526056e',
    usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_11155111 || '0x8267cF9254734C6Eb452a7bb9AAF97B392258b21',
  },
};

export function getContracts(chainId: number): ChainContracts | undefined {
  return CHAIN_CONFIGS[chainId];
}

export function getContract(chainId: number, key: keyof ChainContracts): string | undefined {
  return CHAIN_CONFIGS[chainId]?.[key];
}
