/**
 * @file verifyV2.ts
 * @description Verify V2 multi-tenant adapters on block explorer
 *
 * Usage:
 *   npx hardhat run scripts/verifyV2.ts --network baseSepolia
 *   npx hardhat run scripts/verifyV2.ts --network sepolia
 */

import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const networkName = process.env.HARDHAT_NETWORK || "baseSepolia";
  const deploymentPath = path.join(__dirname, "..", "deployments", `${networkName}-v2.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment not found: ${deploymentPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const c = deployment.contracts;
  const deployer = deployment.deployer;

  console.log(`\nVerifying V2 contracts on ${networkName}...\n`);

  const contractsToVerify: Array<{ name: string; address: string; args: any[]; path?: string }> = [
    { name: "AdapterRegistry", address: c.adapterRegistry, args: [deployer] },
    { name: "MarketDeployer", address: c.marketDeployer, args: [] },
    { name: "MarketFactoryV2", address: c.marketFactory, args: [deployer, deployer, c.adapterRegistry, c.marketDeployer] },
    { name: "ERC20Adapter", address: c.erc20Adapter, args: [c.marketFactory], path: "src/adapters/asset/ERC20Adapter.sol:ERC20Adapter" },
    { name: "ERC721Adapter", address: c.erc721Adapter, args: [c.marketFactory], path: "src/adapters/asset/ERC721Adapter.sol:ERC721Adapter" },
    { name: "ChainlinkAdapter", address: c.chainlinkAdapter, args: [c.marketFactory], path: "src/adapters/oracle/ChainlinkAdapter.sol:ChainlinkAdapter" },
    { name: "StandardPositionAdapter", address: c.standardPosition, args: [], path: "src/adapters/position/StandardPositionAdapter.sol:StandardPositionAdapter" },
    { name: "SoulboundPositionAdapter", address: c.soulboundPosition, args: [], path: "src/adapters/position/SoulboundPositionAdapter.sol:SoulboundPositionAdapter" },
    { name: "TransferablePositionAdapter", address: c.transferablePosition, args: [], path: "src/adapters/position/TransferablePositionAdapter.sol:TransferablePositionAdapter" },
    { name: "DEXSwapLiquidationAdapter", address: c.dexSwapLiquidation, args: [c.marketFactory], path: "src/adapters/liquidation/DEXSwapLiquidationAdapter.sol:DEXSwapLiquidationAdapter" },
    { name: "NFTAuctionLiquidationAdapter", address: c.nftAuctionLiquidation, args: [c.marketFactory], path: "src/adapters/liquidation/NFTAuctionLiquidationAdapter.sol:NFTAuctionLiquidationAdapter" },
  ];

  if (c.uniswapV3TWAPAdapter) {
    const quoteToken = networkName === "baseSepolia"
      ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
      : "0x8267cF9254734C6Eb452a7bb9AAF97B392258b21";
    contractsToVerify.push({
      name: "UniswapV3TWAPAdapter",
      address: c.uniswapV3TWAPAdapter,
      args: [600, quoteToken, c.marketFactory],
      path: "src/adapters/oracle/UniswapV3TWAPAdapter.sol:UniswapV3TWAPAdapter"
    });
  }

  for (const contract of contractsToVerify) {
    console.log(`Verifying ${contract.name} at ${contract.address}...`);
    try {
      await run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.args,
        contract: contract.path || `src/${contract.name}.sol:${contract.name}`,
      });
      console.log(`  ✅ ${contract.name} verified\n`);
    } catch (error: any) {
      if (error.message?.includes("Already Verified")) {
        console.log(`  ⚠️  Already verified\n`);
      } else if (error.message?.includes("does not have bytecode")) {
        console.log(`  ❌ Not deployed\n`);
      } else {
        console.log(`  ❌ ${error.message}\n`);
      }
    }
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
