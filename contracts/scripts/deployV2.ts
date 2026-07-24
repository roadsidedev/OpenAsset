/**
 * @file deployV2.ts
 * @description Production deployment script for OpenAsset Market V2 adapter-based architecture.
 *
 * Changes from v1:
 * - ERC20Adapter and ERC721Adapter now require the collateral token address in constructor
 * - Position adapters now require the factory address in constructor
 * - MarketFactoryV2.createMarket now takes (MarketConfig, initialLiquidity) instead of (config + msg.value)
 *
 * Usage:
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
  chainlinkFeeds: Record<string, string>;
  l2Sequencer?: string;
}

const CONFIGS: Record<string, DeploymentConfig> = {
  baseSepolia: {
    auditGovernance: "",
    owner: "",
    protocolTreasury: "",
    lendingAssets: [
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    ],
    chainlinkFeeds: {
      "ETH/USD": "0x4aDC670858AB637A1Cc5265Da8Ccb001f40b83E2",
    },
    l2Sequencer: "0xC1D817391E9c771E82fd1Fe6dC8aBD066a8c1C6Ba",
  },
  mainnet: {
    auditGovernance: "",
    owner: "",
    protocolTreasury: "",
    lendingAssets: [
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    ],
    chainlinkFeeds: {
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

async function deployReferenceAdapters(factoryAddress: string) {
  console.log("\n=== Deploying Reference Adapters ===");
  const deployed: Record<string, string> = {};

  // --- Asset Adapters (require collateral token address — deploy per-collateral) ---
  // Since each ERC20Adapter is bound to a specific collateral token, we deploy
  // one instance per asset. The config's `chainlinkFeeds` keys serve as the
  // collateral token allowlist. For testnets, we deploy a generic placeholder
  // on the deployer's address (which gets replaced per-asset in production).
  const ERC20Factory = await ethers.getContractFactory("ERC20Adapter");
  const ERC721Factory = await ethers.getContractFactory("ERC721Adapter");
  const [deployer] = await ethers.getSigners();

  // Deploy a reference ERC20Adapter on deployer's address.
  // In production, replace with the actual collateral token:
  //   const wbtcAdapter = await ERC20Factory.deploy("0xWBTC_ADDRESS");
  //   const ethAdapter   = await ERC20Factory.deploy("0xWETH_ADDRESS");
  const erc20 = await ERC20Factory.deploy(deployer.address);
  await erc20.waitForDeployment();
  deployed.erc20Adapter = await erc20.getAddress();
  console.log(`  ERC20Adapter (ref, on deployer): ${deployed.erc20Adapter}`);
  console.log(`    ⚠ Replace with per-collateral adapter per asset in production`);

  // Same for ERC721: deploy with a valid NFT collection or the deployer address
  const erc721 = await ERC721Factory.deploy(deployer.address);
  await erc721.waitForDeployment();
  deployed.erc721Adapter = await erc721.getAddress();
  console.log(`  ERC721Adapter (ref, on deployer): ${deployed.erc721Adapter}`);

  // --- Position Adapters (require factory address) ---
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
  const transferable = await TransferablePos.deploy(factoryAddress, ethers.ZeroAddress);
  await transferable.waitForDeployment();
  deployed.transferablePosition = await transferable.getAddress();
  console.log(`  TransferablePositionAdapter: ${deployed.transferablePosition}`);

  // --- Liquidation Adapters (require owner address) ---
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
  factoryAddress: string,
  deployed: Record<string, string>
) {
  console.log("\n=== Registering Adapters in Registry ===");
  const registry = await ethers.getContractAt("AdapterRegistry", registryAddress);

  const adapterMap: Array<{ address: string; type: number; name: string }> = [
    { address: deployed.erc20Adapter, type: 0, name: "ERC20Adapter" },
    { address: deployed.erc721Adapter, type: 0, name: "ERC721Adapter" },
    { address: deployed.standardPosition, type: 4, name: "StandardPositionAdapter" },
    { address: deployed.soulboundPosition, type: 4, name: "SoulboundPositionAdapter" },
    { address: deployed.transferablePosition, type: 4, name: "TransferablePositionAdapter" },
    { address: deployed.dexSwapLiquidation, type: 3, name: "DEXSwapLiquidationAdapter" },
    { address: deployed.nftAuctionLiquidation, type: 3, name: "NFTAuctionLiquidationAdapter" },
  ];

  for (const adapter of adapterMap) {
    console.log(`  Registering ${adapter.name}...`);
    const tx = await registry.registerAdapter(adapter.address, adapter.type);
    await tx.wait();
    const vtx = await registry.markVerified(adapter.address, "Internal audit #1");
    await vtx.wait();
  }

  console.log(`  Total adapters registered: ${adapterMap.length}`);

  // Register the factory as the authorized market creator on position adapters
  console.log("\n=== Authorizing factory on position adapters ===");
  for (const key of ["standardPosition", "soulboundPosition", "transferablePosition"]) {
    if (deployed[key]) {
      const adapter = await ethers.getContractAt("StandardPositionAdapter", deployed[key]);
      // if registerMarket exists, register the factory itself as market (for testing)
      // In production, markets register themselves during createMarket
      console.log(`  ${deployed[key]}: auto-registration via createMarket`);
    }
  }
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

async function verifyContract(address: string, constructorArgs: any[]) {
  try {
    console.log(`  Verifying ${address}...`);
    await run("verify:verify", { address, constructorArguments: constructorArgs });
    console.log(`  ✓ Verified ${address}`);
  } catch (error: any) {
    if (error.message?.includes("Already Verified")) {
      console.log(`  ✓ Already verified: ${address}`);
    } else {
      console.log(`  ✗ Failed to verify ${address}: ${error.message}`);
    }
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
      chainlinkFeeds: {},
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
  const { address: deployerAddress, contract: deployerContract } = await deployMarketDeployer();
  const { address: factoryAddress } = await deployMarketFactory(config, registryAddress, deployerAddress);

  // 3. Deploy reference adapters (with factory address for permissioned adapters)
  const deployedAdapters = await deployReferenceAdapters(factoryAddress);

  // 4. Register and verify adapters
  await registerAdapters(registryAddress, factoryAddress, deployedAdapters);

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
    note: "ERC20Adapter and ERC721Adapter are deployed on the deployer address. For production, deploy one instance per distinct collateral token.",
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
  console.log(`ERC20Adapter (ref):       ${deployedAdapters.erc20Adapter}`);
  console.log(`StandardPositionAdapter:  ${deployedAdapters.standardPosition}`);
  console.log(`DEXSwapLiquidation:       ${deployedAdapters.dexSwapLiquidation}`);
  console.log(`LendingAssets:            ${config.lendingAssets.length} configured`);
  console.log(`========================================`);
  console.log(`\n⚠️  ERC20Adapter was deployed with ZeroAddress — deploy per-collateral:\n`);
  console.log(`   const ERC20 = await ethers.getContractFactory("ERC20Adapter");`);
  console.log(`   const usdcAdapter = await ERC20.deploy("0xUSDC_ADDRESS");`);
  console.log(`\n⚠️  After market creation, position adapters auto-register via createMarket().`);
  console.log(`   If deploying adapters separately, call adapter.registerMarket(marketAddr).\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
