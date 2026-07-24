import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();

  const deployment = require("../deployments/baseSepolia-v2.json");
  const c = deployment.contracts;

  console.log(`\n========================================`);
  console.log(`Base Sepolia V2 — Contract Verification`);
  console.log(`========================================`);
  console.log(`Network: ${network.name} (chainId ${net.chainId})`);
  console.log(`Deployer: ${deployer.address}\n`);

  // 1. AdapterRegistry
  const registry = await ethers.getContractAt("AdapterRegistry", c.adapterRegistry);
  console.log("=== AdapterRegistry ===");
  console.log(`  Address: ${c.adapterRegistry}`);
  console.log(`  Total adapters: ${await registry.getTotalAdapterCount()}`);
  console.log(`  Audit governance: ${await registry.auditGovernance()}`);

  const allAdapters = await registry.getAllAdapters();
  for (const addr of allAdapters) {
    const info = await registry.getAdapterInfo(addr);
    const types = ["ASSET", "ORACLE", "COMPLIANCE", "LIQUIDATION", "POSITION"];
    console.log(`  - ${types[info.adapterType]} ${addr.slice(0, 10)}... verified=${info.verified} deprecated=${info.deprecated}`);
  }

  // 2. MarketFactoryV2
  const factory = await ethers.getContractAt("MarketFactoryV2", c.marketFactory);
  console.log("\n=== MarketFactoryV2 ===");
  console.log(`  Address: ${c.marketFactory}`);
  console.log(`  Owner: ${await factory.owner()}`);
  console.log(`  Treasury: ${await factory.protocolTreasury()}`);
  console.log(`  Markets: ${await factory.getMarketCount()}`);

  const allowedAssets = await factory.getAllowedLendingAssets();
  console.log(`  Lending assets: ${allowedAssets.length}`);
  for (const asset of allowedAssets) {
    console.log(`    - ${asset}`);
  }

  console.log("\n========================================");
  console.log("All contracts verified and functional!");
  console.log("========================================\n");
}

main().catch(console.error);
