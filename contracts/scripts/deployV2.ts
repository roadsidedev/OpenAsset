/**
 * @file deployV2.ts
 * @description Production deployment script for OpenAsset Market V2 multi-tenant adapter architecture.
 *
 * Idempotent / resume-safe: re-running the script on the same network reuses already-deployed
 * contract addresses (from the saved deployment JSON) and skips already-registered adapters,
 * already-registered feeds, and already-allowlisted lending assets. This makes retries cheap and
 * safe if an RPC hiccup interrupts a run partway.
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
  b20PolicyRegistry?: string;
  equityFeeds?: Record<string, string>; // B20 token => Chainlink TRV feed (for ChainlinkEquityFeedAdapter)
}

const B20_POLICY_REGISTRY_BASE = "0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD";
const BASE_SEQUENCER_FEED = "0xBCF85224fc0756B9Fa45aA7892530B47e10b6433";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Base mainnet B20 token addresses (precompiles)
const B20_TOKENS_BASE: Record<string, string> = {
  AAPLc: "0xb200000000000000000000C2e324d24d7eEcd1fb",
  AMZNc: "0xb200000000000000000000d9192b6B456483C2E8",
  COINc: "0xb200000000000000000000c85a31389D71F3ecfb",
  CRCLc: "0xB20000000000000000000019f6E7C675b73C2e4D",
  GOOGLc: "0xb2000000000000000000002D0BA3164cc74f58B7",
  INTCc: "0xB2000000000000000000004AFF16039bA04bdFBc",
  METAc: "0xb2000000000000000000008bC8786B856E61707C",
  MSFTc: "0xB200000000000000000000Ab99cFa739E253872B",
  MSTRc: "0xb2000000000000000000004884b426556b92883d",
  NVDAc: "0xb20000000000000000000078ee7ce2fE4908108C",
  SNDKc: "0xb200000000000000000000397293Cb8cda9a10c5",
  SPCXc: "0xb2000000000000000000007b9fcbd005511aCBd5",
  TSLAc: "0xb2000000000000000000001e800a7f5189430cD0",
};

// Chainlink total-return feeds for Base tokenized stocks (8 decimals, 24/5, 0.5% / 24h)
const B20_FEEDS_BASE: Record<string, string> = {
  AAPLc: "0x787f13dEa48Db0897CbCDD985de77809D837F988",
  AMZNc: "0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295",
  COINc: "0x408e44f504A7371a345F03a73dDC96A4b48e8aa7",
  CRCLc: "0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33",
  GOOGLc: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2",
  INTCc: "0xAB657C39bac0D5886250D70849e2E3E008F2EECB",
  METAc: "0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D",
  MSFTc: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c",
  MSTRc: "0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a",
  NVDAc: "0x04689a41629776563E6822F76f2e57D148d28513",
  SNDKc: "0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA",
  SPCXc: "0x6A634B235903C4ad6376892180d6fF8612e3Fa68",
  TSLAc: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4",
};

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
        feed: "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E",
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
      USDC_BASE_SEPOLIA,
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
    uniswapV3QuoteToken: USDC_BASE_SEPOLIA,
    b20PolicyRegistry: B20_POLICY_REGISTRY_BASE,
  },
  base: {
    auditGovernance: "",
    owner: "",
    protocolTreasury: "",
    lendingAssets: [USDC_BASE],
    l2Sequencer: BASE_SEQUENCER_FEED,
    uniswapV3QuoteToken: USDC_BASE,
    b20PolicyRegistry: B20_POLICY_REGISTRY_BASE,
    equityFeeds: B20_FEEDS_BASE,
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

const deploymentPathFor = (networkName: string) =>
  path.join(__dirname, "..", "deployments", `${networkName}-v2.json`);

function loadExistingDeployment(networkName: string): Record<string, string> | null {
  const p = deploymentPathFor(networkName);
  if (!fs.existsSync(p)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return (j.contracts as Record<string, string>) ?? null;
  } catch {
    return null;
  }
}

/** Retry on transient RPC errors (headers timeouts, connection resets, connect timeouts). */
async function retry<T>(fn: () => Promise<T>, label: string, attempts = 6): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (i >= attempts) throw e;
      const msg = (e?.code || e?.message || String(e)).slice(0, 80);
      if (!/UND_ERR|ETIMEDOUT|ECONNRESET|timeout|Timeout|ConnectTimeout/i.test(msg)) throw e;
      console.log(`    [retry ${i}/${attempts}] ${label} (${msg})`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/** Wait for a tx with retries. */
async function waitTx(tx: any, label: string, attempts = 6): Promise<any> {
  return retry(() => tx.wait(), label, attempts);
}

async function deployAdapterRegistry(config: DeploymentConfig, existing?: Record<string, string>) {
  if (existing?.adapterRegistry) {
    console.log(`\n  AdapterRegistry (reuse): ${existing.adapterRegistry}`);
    return { address: existing.adapterRegistry };
  }
  console.log("\n=== Deploying AdapterRegistry ===");
  const Registry = await ethers.getContractFactory("AdapterRegistry");
  const registry = await Registry.deploy(config.auditGovernance);
  await waitTx(registry.deploymentTransaction(), "AdapterRegistry.deploy");
  const address = await registry.getAddress();
  console.log(`  AdapterRegistry: ${address}`);
  return { address };
}

async function deployMarketDeployer(existing?: Record<string, string>) {
  if (existing?.marketDeployer) {
    console.log(`  MarketDeployer (reuse): ${existing.marketDeployer}`);
    return { address: existing.marketDeployer };
  }
  console.log("\n=== Deploying MarketDeployer ===");
  const Deployer = await ethers.getContractFactory("MarketDeployer");
  const dep = await Deployer.deploy();
  await waitTx(dep.deploymentTransaction(), "MarketDeployer.deploy");
  const address = await dep.getAddress();
  console.log(`  MarketDeployer: ${address}`);
  return { address };
}

async function deployMarketFactory(config: DeploymentConfig, registryAddress: string, deployerAddress: string, existing?: Record<string, string>) {
  if (existing?.marketFactory) {
    console.log(`  MarketFactoryV2 (reuse): ${existing.marketFactory}`);
    return { address: existing.marketFactory };
  }
  console.log("\n=== Deploying MarketFactoryV2 ===");
  const Factory = await ethers.getContractFactory("MarketFactoryV2");
  const factory = await Factory.deploy(
    config.owner,
    config.protocolTreasury,
    registryAddress,
    deployerAddress
  );
  await waitTx(factory.deploymentTransaction(), "MarketFactoryV2.deploy");
  const address = await factory.getAddress();
  console.log(`  MarketFactoryV2: ${address}`);
  return { address };
}

async function deployReferenceAdapters(factoryAddress: string, config: DeploymentConfig, deployerAddress: string, existing?: Record<string, string>) {
  console.log("\n=== Deploying Multi-Tenant Reference Adapters ===");
  const deployed: Record<string, string> = { ...existing };

  const deployIfMissing = async (label: string, factoryX: any, args: any[], key: string) => {
    if (deployed[key]) {
      console.log(`  ${label} (reuse): ${deployed[key]}`);
      return;
    }
    const c = await factoryX.deploy(...args);
    await waitTx(c.deploymentTransaction(), `${label}.deploy`);
    deployed[key] = await c.getAddress();
    console.log(`  ${label}: ${deployed[key]}`);
  };

  // --- Asset Adapters ---
  const ERC20Factory = await ethers.getContractFactory("ERC20Adapter");
  await deployIfMissing("ERC20Adapter", ERC20Factory, [factoryAddress], "erc20Adapter");

  const ERC721Factory = await ethers.getContractFactory("ERC721Adapter");
  await deployIfMissing("ERC721Adapter", ERC721Factory, [factoryAddress], "erc721Adapter");

  // --- B20 Asset Adapter (Base tokenized stocks) — deploy if registry configured ---
  if (config.b20PolicyRegistry) {
    const B20AssetFactory = await ethers.getContractFactory("B20AssetAdapter");
    await deployIfMissing("B20AssetAdapter", B20AssetFactory, [factoryAddress, config.b20PolicyRegistry], "b20AssetAdapter");

    const B20ComplianceFactory = await ethers.getContractFactory("B20PolicyComplianceAdapter");
    await deployIfMissing("B20PolicyComplianceAdapter", B20ComplianceFactory, [factoryAddress, config.b20PolicyRegistry], "b20PolicyComplianceAdapter");

    const EquityFactory = await ethers.getContractFactory("ChainlinkEquityFeedAdapter");
    await deployIfMissing("ChainlinkEquityFeedAdapter", EquityFactory, [factoryAddress], "chainlinkEquityFeedAdapter");

    if (deployed.chainlinkEquityFeedAdapter) {
      console.log(`  ChainlinkEquityFeedAdapter deployed for B20 TRV feeds (per-market registerFeed uses maxStaleness 90000, sequencer ${config.l2Sequencer || "none"})`);
      // Note: equity feeds are per-market, not global. No global registration here.
      // Feed table is B20_FEEDS_BASE; per-market registration happens at market creation time via registerFeed(market, feed, 90000, sequencer).
    }
  }

  // --- Oracle Adapters ---
  const ChainlinkFactory = await ethers.getContractFactory("ChainlinkAdapter");
  await deployIfMissing("ChainlinkAdapter", ChainlinkFactory, [factoryAddress, deployerAddress], "chainlinkAdapter");

  if (deployed.chainlinkAdapter) {
    const chainlink = await ethers.getContractAt("ChainlinkAdapter", deployed.chainlinkAdapter);

    if (config.chainlinkFeeds && Object.keys(config.chainlinkFeeds).length > 0) {
      for (const [asset, cfg] of Object.entries(config.chainlinkFeeds)) {
        const staleness = cfg.staleness ?? 3600;
        const current = await retry(() => chainlink.assetFeeds(asset), `assetFeeds(${asset})`);
        if (current.feed.toLowerCase() === cfg.feed.toLowerCase()) {
          console.log(`  Feed for ${asset} (already registered): ${cfg.feed}`);
          continue;
        }
        console.log(`  Registering feed for ${asset} -> ${cfg.feed} (staleness ${staleness}s)`);
        await waitTx(await chainlink.registerFeed(asset, cfg.feed, staleness), `registerFeed(${asset})`);
      }
    } else {
      console.log(`  WARNING: no chainlinkFeeds configured for ${network.name}; ChainlinkAdapter will return untrusted prices`);
    }

    if (config.l2Sequencer) {
      const seq = await retry(() => chainlink.l2SequencerFeed(), "l2SequencerFeed");
      if (seq.toLowerCase() !== config.l2Sequencer.toLowerCase()) {
        console.log(`  Setting L2 sequencer feed: ${config.l2Sequencer}`);
        await waitTx(await chainlink.setL2SequencerFeed(config.l2Sequencer), "setL2SequencerFeed");
      } else {
        console.log(`  L2 sequencer feed (already set): ${config.l2Sequencer}`);
      }
    } else {
      console.log(`  No L2 sequencer feed configured for ${network.name}; sequencer check disabled`);
    }
  }

  if (config.uniswapV3QuoteToken) {
    const UniswapTWAPFactory = await ethers.getContractFactory("UniswapV3TWAPAdapter");
    await deployIfMissing("UniswapV3TWAPAdapter", UniswapTWAPFactory, [600, config.uniswapV3QuoteToken, factoryAddress], "uniswapV3TWAPAdapter");
  }

  // --- Position Adapters ---
  const StandardPos = await ethers.getContractFactory("StandardPositionAdapter");
  await deployIfMissing("StandardPositionAdapter", StandardPos, [factoryAddress], "standardPosition");
  const SoulboundPos = await ethers.getContractFactory("SoulboundPositionAdapter");
  await deployIfMissing("SoulboundPositionAdapter", SoulboundPos, [factoryAddress], "soulboundPosition");
  const TransferablePos = await ethers.getContractFactory("TransferablePositionAdapter");
  await deployIfMissing("TransferablePositionAdapter", TransferablePos, [factoryAddress], "transferablePosition");

  // --- Liquidation Adapters ---
  const DEXSwap = await ethers.getContractFactory("DEXSwapLiquidationAdapter");
  await deployIfMissing("DEXSwapLiquidationAdapter", DEXSwap, [factoryAddress], "dexSwapLiquidation");
  const NFTAuction = await ethers.getContractFactory("NFTAuctionLiquidationAdapter");
  await deployIfMissing("NFTAuctionLiquidationAdapter", NFTAuction, [factoryAddress], "nftAuctionLiquidation");

  return deployed;
}

async function registerAdapters(registryAddress: string, deployed: Record<string, string>) {
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
  if (deployed.b20AssetAdapter) {
    adapterMap.push({ address: deployed.b20AssetAdapter, type: 0, name: "B20AssetAdapter" });
  }
  if (deployed.b20PolicyComplianceAdapter) {
    adapterMap.push({ address: deployed.b20PolicyComplianceAdapter, type: 2, name: "B20PolicyComplianceAdapter" });
  }
  if (deployed.chainlinkEquityFeedAdapter) {
    adapterMap.push({ address: deployed.chainlinkEquityFeedAdapter, type: 1, name: "ChainlinkEquityFeedAdapter" });
  }

  for (const adapter of adapterMap) {
    const info = await retry(() => registry.adapters(adapter.address), `registry.adapters(${adapter.name})`);
    const isRegistered = info.registeredBy !== ethers.ZeroAddress;
    if (isRegistered && info.verified) {
      console.log(`  ${adapter.name} (already registered + verified)`);
      continue;
    }
    if (!isRegistered) {
      console.log(`  Registering ${adapter.name}...`);
      await retry(async () => {
        const tx = await registry.registerAdapter(adapter.address, adapter.type);
        await tx.wait();
      }, `registerAdapter(${adapter.name})`);
    } else {
      console.log(`  ${adapter.name} already registered; skipping`);
    }
    if (!info.verified) {
      console.log(`  Verifying ${adapter.name}...`);
      await retry(async () => {
        const vtx = await registry.markVerified(adapter.address, "OpenAsset internal audit — multi-tenant reference adapter");
        await vtx.wait();
      }, `markVerified(${adapter.name})`);
    }
  }

  console.log(`  Total adapters registered and verified: ${adapterMap.length}`);
}

async function configureLendingAssets(factoryAddress: string, lendingAssets: string[]) {
  console.log("\n=== Configuring Lending Assets ===");
  const factory = await ethers.getContractAt("MarketFactoryV2", factoryAddress);
  for (const asset of lendingAssets) {
    const allowed = await retry(() => factory.isAllowedLendingAsset(asset), `isAllowedLendingAsset(${asset})`);
    if (allowed) {
      console.log(`  ${asset} (already allowed)`);
      continue;
    }
    console.log(`  Adding ${asset}...`);
    await retry(async () => {
      const tx = await factory.addLendingAsset(asset);
      await tx.wait();
    }, `addLendingAsset(${asset})`);
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

  const existing = loadExistingDeployment(networkName);

  console.log(`\n========================================`);
  console.log(`OpenAsset Market V2 Deployment — ${networkName}`);
  console.log(`========================================`);

  const deployer = (await ethers.getSigners())[0];
  console.log(`Deployer: ${deployer.address}`);

  if (!config.auditGovernance) config.auditGovernance = deployer.address;
  if (!config.owner) config.owner = deployer.address;
  if (!config.protocolTreasury) config.protocolTreasury = deployer.address;

  // 1. Deploy AdapterRegistry
  const { address: registryAddress } = await deployAdapterRegistry(config, existing ?? undefined);

  // 2. Deploy MarketDeployer + MarketFactoryV2
  const { address: deployerAddress } = await deployMarketDeployer(existing ?? undefined);
  const { address: factoryAddress } = await deployMarketFactory(config, registryAddress, deployerAddress, existing ?? undefined);

  // 3. Deploy multi-tenant reference adapters
  const deployedAdapters = await deployReferenceAdapters(factoryAddress, config, deployer.address, existing ?? undefined);

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
  const outputPath = deploymentPathFor(networkName);
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
  if (deployedAdapters.chainlinkEquityFeedAdapter) {
    console.log(`ChainlinkEquityFeed:      ${deployedAdapters.chainlinkEquityFeedAdapter}`);
  }
  if (deployedAdapters.b20AssetAdapter) {
    console.log(`B20AssetAdapter:          ${deployedAdapters.b20AssetAdapter}`);
  }
  if (deployedAdapters.b20PolicyComplianceAdapter) {
    console.log(`B20PolicyCompliance:      ${deployedAdapters.b20PolicyComplianceAdapter}`);
  }
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
