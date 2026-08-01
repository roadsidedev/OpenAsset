/**
 * @file deployV2.ts
 * @description Production deployment script for OpenAsset Market V2 multi-tenant adapter architecture.
 *
 * Changes from v1 constructor-per-instance pattern:
 * - All adapters use multi-tenancy: one instance, many markets via configure()
 * - Position adapters are clone templates (deploy template, factory clones per market)
 * - ERC20Adapter, ERC721Adapter, ChainlinkAdapter etc. take factory address, not collateral/feed
 *
 * Usage:
 *   npx hardhat run scripts/deployV2.ts --network sepolia
 *   npx hardhat run scripts/deployV2.ts --network baseSepolia
 *   npx hardhat run scripts/deployV2.ts --network mainnet
 */

import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentConfig {
  auditGovernance: string;
  owner: string;
  protocolTreasury: string;
  lendingAssets: string[];
  sepoliaChainlinkFeeds?: Record<string, string>;
  baseChainlinkFeeds?: Record<string, string>;
  chainlinkFeeds?: Record<string, { feed: string; staleness?: number }>; // collateral asset => feed
  l2Sequencer?: string; // L2 Sequencer Uptime Feed (empty string disables the check)
  uniswapV3QuoteToken?: string; // Address of quote token for TWAP
}

const CONFIGS: Record<string, DeploymentConfig> = {
  sepolia: {
    auditGovernance: "",
    owner: "",
    protocolTreasury: "",
    lendingAssets: [
      "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia (6 decimals)
    ],
    chainlinkFeeds: {
      // WETH => ETH/USD feed
      "0xfff9976782d46cc05630d1f6ebab18b2324d6b14": {
        feed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
        staleness: 3600,
      },
      // USDC => USDC/USD feed
      "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238": {
        feed: "0xA2F78ab2355fe2f984D808B5CeE7FD0a93D5270E",
        staleness: 86400,
      },
    },
    // Sepolia is L1 — no L2 sequencer uptime feed.
    l2Sequencer: "",
    uniswapV3QuoteToken: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
  },
  baseSepolia: {
    auditGovernance: "",
    owner: "",
    protocolTreasury: "",
    lendingAssets: [
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    ],
    chainlinkFeeds: {
      // WETH => ETH/USD feed
      "0x4200000000000000000000000000000000000006": {
        feed: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
        staleness: 3600,
      },
      // USDC => USDC/USD feed
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e": {
        feed: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
        staleness: 86400,
      },
    },
    // Base Sepolia does not publish an L2 Sequencer Uptime Feed, so the check is disabled.
    l2Sequencer: "",
    uniswapV3QuoteToken: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC
  },
  mainnet: {
    auditGovernance: "",
    owner: "",
    protocolTreasury: "",
    lendingAssets: [
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    ],
    baseChainlinkFeeds: {
      "ETH/USD": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
      "WBTC/USD": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    },
  },
};

async function deployAdapterRegistry(config: DeploymentConfig) {
  console.log("\n=== Deploying AdapterRegistry ===");
  const Registry = await ethers.getContractFactory("AdapterRegistry");
  const registry = await Registry.deploy(config.auditGovernance);
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`  AdapterRegistry: ${address}`);
  return { contract: registry, address };
}

async function deployMarketDeployer() {
  console.log("\n=== Deploying MarketDeployer ===");
  const Deployer = await ethers.getContractFactory("MarketDeployer");
  const dep = await Deployer.deploy();
  await dep.waitForDeployment();
  const address = await dep.getAddress();
  console.log(`  MarketDeployer: ${address}`);
  return { contract: dep, address };
}

async function deployMarketFactory(config: DeploymentConfig, registryAddress: string, deployerAddress: string) {
  console.log("\n=== Deploying MarketFactoryV2 ===");
  const Factory = await ethers.getContractFactory("MarketFactoryV2");
  const factory = await Factory.deploy(
    config.owner,
    config.protocolTreasury,
    registryAddress,
    deployerAddress
  );
  await factory.waitForDeployment();
  const address = await factory.getAddress();
  console.log(`  MarketFactoryV2: ${address}`);
  return { contract: factory, address };
}

async function deployReferenceAdapters(factoryAddress: string, config: DeploymentConfig, deployerAddress: string) {
  console.log("\n=== Deploying Multi-Tenant Reference Adapters ===");
  const deployed: Record<string, string> = {};

  // --- Asset Adapters (multi-tenant: one instance per factory, all tokens) ---
  const ERC20Factory = await ethers.getContractFactory("ERC20Adapter");
  const erc20 = await ERC20Factory.deploy(factoryAddress);
  await erc20.waitForDeployment();
  deployed.erc20Adapter = await erc20.getAddress();
  console.log(`  ERC20Adapter: ${deployed.erc20Adapter}`);

  const ERC721Factory = await ethers.getContractFactory("ERC721Adapter");
  const erc721 = await ERC721Factory.deploy(factoryAddress);
  await erc721.waitForDeployment();
  deployed.erc721Adapter = await erc721.getAddress();
  console.log(`  ERC721Adapter: ${deployed.erc721Adapter}`);

  // --- Oracle Adapters (multi-tenant) ---
  const ChainlinkFactory = await ethers.getContractFactory("ChainlinkAdapter");
  const chainlink = await ChainlinkFactory.deploy(factoryAddress, deployerAddress);
  await chainlink.waitForDeployment();
  deployed.chainlinkAdapter = await chainlink.getAddress();
  console.log(`  ChainlinkAdapter: ${deployed.chainlinkAdapter}`);

  // Register Chainlink price feeds per collateral asset + optional L2 sequencer feed
  if (config.chainlinkFeeds && Object.keys(config.chainlinkFeeds).length > 0) {
    for (const [asset, cfg] of Object.entries(config.chainlinkFeeds)) {
      const staleness = cfg.staleness ?? 3600;
      console.log(`  Registering feed for ${asset} -> ${cfg.feed} (staleness ${staleness}s)`);
      const tx = await chainlink.registerFeed(asset, cfg.feed, staleness);
      await tx.wait();
    }
  } else {
    console.log(`  WARNING: no chainlinkFeeds configured for ${network.name}; ChainlinkAdapter will return untrusted prices`);
  }

  if (config.l2Sequencer) {
    console.log(`  Setting L2 sequencer feed: ${config.l2Sequencer}`);
    const tx = await chainlink.setL2SequencerFeed(config.l2Sequencer);
    await tx.wait();
  } else {
    console.log(`  No L2 sequencer feed configured for ${network.name}; sequencer check disabled`);
  }

  if (config.uniswapV3QuoteToken) {
    const UniswapTWAPFactory = await ethers.getContractFactory("UniswapV3TWAPAdapter");
    const uniswap = await UniswapTWAPFactory.deploy(600, config.uniswapV3QuoteToken, factoryAddress);
    await uniswap.waitForDeployment();
    deployed.uniswapV3TWAPAdapter = await uniswap.getAddress();
    console.log(`  UniswapV3TWAPAdapter: ${deployed.uniswapV3TWAPAdapter}`);
  }

  // --- Position Adapters (multi-tenant instances — factory calls registerMarket() directly) ---
  const StandardPos = await ethers.getContractFactory("StandardPositionAdapter");
  const standard = await StandardPos.deploy(factoryAddress);
  await standard.waitForDeployment();
  deployed.standardPosition = await standard.getAddress();
  console.log(`  StandardPositionAdapter: ${deployed.standardPosition}`);

  const SoulboundPos = await ethers.getContractFactory("SoulboundPositionAdapter");
  const soulbound = await SoulboundPos.deploy(factoryAddress);
  await soulbound.waitForDeployment();
  deployed.soulboundPosition = await soulbound.getAddress();
  console.log(`  SoulboundPositionAdapter: ${deployed.soulboundPosition}`);

  const TransferablePos = await ethers.getContractFactory("TransferablePositionAdapter");
  const transferable = await TransferablePos.deploy(factoryAddress);
  await transferable.waitForDeployment();
  deployed.transferablePosition = await transferable.getAddress();
  console.log(`  TransferablePositionAdapter: ${deployed.transferablePosition}`);

  // --- Liquidation Adapters (multi-tenant, orchestrate through Asset Adapter) ---
  const DEXSwap = await ethers.getContractFactory("DEXSwapLiquidationAdapter");
  const dexSwap = await DEXSwap.deploy(factoryAddress);
  await dexSwap.waitForDeployment();
  deployed.dexSwapLiquidation = await dexSwap.getAddress();
  console.log(`  DEXSwapLiquidationAdapter: ${deployed.dexSwapLiquidation}`);

  const NFTAuction = await ethers.getContractFactory("NFTAuctionLiquidationAdapter");
  const nftAuction = await NFTAuction.deploy(factoryAddress);
  await nftAuction.waitForDeployment();
  deployed.nftAuctionLiquidation = await nftAuction.getAddress();
  console.log(`  NFTAuctionLiquidationAdapter: ${deployed.nftAuctionLiquidation}`);

  return deployed;
}

async function registerAdapters(
  registryAddress: string,
  deployed: Record<string, string>
) {
  console.log("\n=== Registering Adapters in Registry ===");
  const registry = await ethers.getContractAt("AdapterRegistry", registryAddress);

  const adapterMap: Array<{ address: string; type: number; name: string }> = [
    { address: deployed.erc20Adapter, type: 0, name: "ERC20Adapter" },
    { address: deployed.erc721Adapter, type: 0, name: "ERC721Adapter" },
    { address: deployed.chainlinkAdapter, type: 1, name: "ChainlinkAdapter" },
    { address: deployed.standardPosition, type: 4, name: "StandardPositionAdapter" },
    { address: deployed.soulboundPosition, type: 4, name: "SoulboundPositionAdapter" },
    { address: deployed.transferablePosition, type: 4, name: "TransferablePositionAdapter" },
    { address: deployed.dexSwapLiquidation, type: 3, name: "DEXSwapLiquidationAdapter" },
    { address: deployed.nftAuctionLiquidation, type: 3, name: "NFTAuctionLiquidationAdapter" },
  ];

  if (deployed.uniswapV3TWAPAdapter) {
    adapterMap.push({ address: deployed.uniswapV3TWAPAdapter, type: 1, name: "UniswapV3TWAPAdapter" });
  }

  for (const adapter of adapterMap) {
    console.log(`  Registering ${adapter.name}...`);
    const tx = await registry.registerAdapter(adapter.address, adapter.type);
    await tx.wait();
    const vtx = await registry.markVerified(adapter.address, "OpenAsset internal audit — multi-tenant reference adapter");
    await vtx.wait();
  }

  console.log(`  Total adapters registered and verified: ${adapterMap.length}`);
}

async function configureLendingAssets(factoryAddress: string, lendingAssets: string[]) {
  console.log("\n=== Configuring Lending Assets ===");
  const factory = await ethers.getContractAt("MarketFactoryV2", factoryAddress);
  for (const asset of lendingAssets) {
    console.log(`  Adding ${asset}...`);
    const tx = await factory.addLendingAsset(asset);
    await tx.wait();
  }
}

async function main() {
  const networkName = network.name;
  let config = CONFIGS[networkName];

  if (!config) {
    console.log(`No config for ${networkName}, using deployer defaults`);
    const [deployer] = await ethers.getSigners();
    config = {
      auditGovernance: deployer.address,
      owner: deployer.address,
      protocolTreasury: deployer.address,
      lendingAssets: [],
    };
  }

  console.log(`\n========================================`);
  console.log(`OpenAsset Market V2 Deployment — ${networkName}`);
  console.log(`========================================`);

  const deployer = (await ethers.getSigners())[0];
  console.log(`Deployer: ${deployer.address}`);

  if (!config.auditGovernance) config.auditGovernance = deployer.address;
  if (!config.owner) config.owner = deployer.address;
  if (!config.protocolTreasury) config.protocolTreasury = deployer.address;

  // 1. Deploy AdapterRegistry
  const { address: registryAddress } = await deployAdapterRegistry(config);

  // 2. Deploy MarketDeployer + MarketFactoryV2
  const { address: deployerAddress } = await deployMarketDeployer();
  const { address: factoryAddress } = await deployMarketFactory(config, registryAddress, deployerAddress);

  // 3. Deploy multi-tenant reference adapters
  const deployedAdapters = await deployReferenceAdapters(factoryAddress, config, deployer.address);

  // 4. Register and verify adapters
  await registerAdapters(registryAddress, deployedAdapters);

  // 5. Configure lending assets
  await configureLendingAssets(factoryAddress, config.lendingAssets);

  // 6. Save deployment output
  const output = {
    network: networkName,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      adapterRegistry: registryAddress,
      marketDeployer: deployerAddress,
      marketFactory: factoryAddress,
      ...deployedAdapters,
    },
    note: "Multi-tenant adapter architecture: one instance per adapter type serves all markets. All adapters (including position adapters) are multi-tenant — the factory calls registerMarket()/configure() per market.",
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `${networkName}-v2.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nDeployment saved to ${outputPath}`);

  console.log(`\n========================================`);
  console.log(`Deployment Complete!`);
  console.log(`========================================`);
  console.log(`AdapterRegistry:          ${registryAddress}`);
  console.log(`MarketFactoryV2:          ${factoryAddress}`);
  console.log(`ERC20Adapter:             ${deployedAdapters.erc20Adapter}`);
  console.log(`ERC721Adapter:            ${deployedAdapters.erc721Adapter}`);
  console.log(`ChainlinkAdapter:         ${deployedAdapters.chainlinkAdapter}`);
  console.log(`StandardPosition:         ${deployedAdapters.standardPosition}`);
  console.log(`SoulboundPosition:        ${deployedAdapters.soulboundPosition}`);
  console.log(`TransferablePosition:     ${deployedAdapters.transferablePosition}`);
  console.log(`DEXSwapLiquidation:       ${deployedAdapters.dexSwapLiquidation}`);
  console.log(`NFTAuctionLiquidation:    ${deployedAdapters.nftAuctionLiquidation}`);
  if (deployedAdapters.uniswapV3TWAPAdapter) {
    console.log(`UniswapV3TWAPAdapter:     ${deployedAdapters.uniswapV3TWAPAdapter}`);
  }
  console.log(`LendingAssets:            ${config.lendingAssets.length} configured`);
  console.log(`========================================`);
  console.log(`\nAll adapters are multi-tenant — one instance per adapter type`);
  console.log(`serves all markets. The Factory calls configure()/registerMarket() per market.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
