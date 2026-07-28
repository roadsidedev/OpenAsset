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
    marketFactory: process.env.NEXT_PUBLIC_MARKET_FACTORY_V2_ADDRESS_84532 || '0xd011C620776a1FaE2F7caC7D15bD0291D1ee4b5a',
    marketDeployer: process.env.NEXT_PUBLIC_MARKET_DEPLOYER_ADDRESS_84532 || '0x08D56e1f00448DC6D381149985a6dA1cFa4A4191',
    adapterRegistry: process.env.NEXT_PUBLIC_ADAPTER_REGISTRY_ADDRESS_84532 || '0x4207cE033a9c88F23a7a70Fc7D5031540c8F2023',
    erc20Adapter: process.env.NEXT_PUBLIC_ERC20_ADAPTER_84532 || '0xB35Ddb2A465344D05EBC7Eb9F6A42995B3075d9B',
    erc721Adapter: process.env.NEXT_PUBLIC_ERC721_ADAPTER_84532 || '0xa64273c87Ca6845D24670863b832fDc4fb044363',
    chainlinkAdapter: process.env.NEXT_PUBLIC_CHAINLINK_ADAPTER_84532 || '0x9f01Fb9928FDfcD5e15E4d607E990FB07DF524CB',
    uniswapV3TWAPAdapter: process.env.NEXT_PUBLIC_UNISWAP_V3_TWAP_ADAPTER_84532 || '0x525499534bcd103aD19552079D1d80aD209988Aa',
    standardPositionAdapter: process.env.NEXT_PUBLIC_STANDARD_POSITION_ADAPTER_84532 || '0x54bf0b87bA15Ff9cBA95396C295Fc355e4574335',
    soulboundPositionAdapter: process.env.NEXT_PUBLIC_SOULBOUND_POSITION_ADAPTER_84532 || '0x001C29355522d3C43378FE3535BC1DB4Ec21B1F6',
    transferablePositionAdapter: process.env.NEXT_PUBLIC_TRANSFERABLE_POSITION_ADAPTER_84532 || '0x99e208eCE2b4513ef8A893B94709A67b2F26A5BA',
    dexSwapLiquidationAdapter: process.env.NEXT_PUBLIC_DEX_SWAP_LIQUIDATION_ADAPTER_84532 || '0xEC78903A3c72d536B0952A2b77939FbFA1e4e28e',
    nftAuctionLiquidationAdapter: process.env.NEXT_PUBLIC_NFT_AUCTION_LIQUIDATION_ADAPTER_84532 || '0x2497d012A3B95E2d9D4B290d5948771A3eaC6b45',
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
