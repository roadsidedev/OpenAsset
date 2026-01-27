import { ethers } from "hardhat";
import { Contract } from "ethers";

/**
 * Red Chips Protocol - Testnet Deployment Script
 * 
 * Deploys:
 * 1. LoanContract implementation (for minimal proxy)
 * 2. NFTOracle (with mock Chainlink feed for testnets)
 * 3. MarketFactory (main entry point)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network sepolia
 *   npx hardhat run scripts/deploy.ts --network baseSepolia
 */

interface DeploymentResult {
  loanImplementation: string;
  nftOracle: string;
  marketFactory: string;
  treasury: string;
  network: string;
  chainId: number;
  deployer: string;
  timestamp: number;
}

// Testnet addresses
const TESTNET_CONFIG: Record<number, {
  usdc: string;
  chainlinkEthUsd: string;
  name: string;
}> = {
  // Sepolia
  11155111: {
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    chainlinkEthUsd: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    name: "Sepolia",
  },
  // Base Sepolia
  84532: {
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    chainlinkEthUsd: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    name: "Base Sepolia",
  },
};

async function main(): Promise<DeploymentResult> {
  console.log("\n🚀 Red Chips Protocol - Testnet Deployment\n");
  console.log("=".repeat(50));

  // Get deployer
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`📍 Network: ${TESTNET_CONFIG[chainId]?.name || "Unknown"} (${chainId})`);
  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Validate network
  if (!TESTNET_CONFIG[chainId]) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const config = TESTNET_CONFIG[chainId];

  // Use deployer as treasury for testing
  const treasury = deployerAddress;
  console.log(`🏦 Treasury: ${treasury}`);

  // ============ 1. Deploy LoanContract Implementation ============
  console.log("\n📦 Deploying LoanContract implementation...");
  
  const LoanContract = await ethers.getContractFactory("LoanContract");
  const loanImplementation = await LoanContract.deploy();
  await loanImplementation.waitForDeployment();
  
  const loanAddress = await loanImplementation.getAddress();
  console.log(`   ✅ LoanContract: ${loanAddress}`);

  // ============ 2. Deploy NFTOracle ============
  console.log("\n📦 Deploying NFTOracle...");
  
  const NFTOracle = await ethers.getContractFactory("NFTOracle");
  const nftOracle = await NFTOracle.deploy(
    deployerAddress,        // Owner
    config.chainlinkEthUsd  // ETH/USD price feed
  );
  await nftOracle.waitForDeployment();
  
  const nftOracleAddress = await nftOracle.getAddress();
  console.log(`   ✅ NFTOracle: ${nftOracleAddress}`);

  // ============ 3. Deploy MarketFactory ============
  console.log("\n📦 Deploying MarketFactory...");
  
  const MarketFactory = await ethers.getContractFactory("MarketFactory");
  const marketFactory = await MarketFactory.deploy(
    deployerAddress,  // Initial owner
    treasury,         // Protocol treasury
    loanAddress       // LoanContract implementation
  );
  await marketFactory.waitForDeployment();
  
  const factoryAddress = await marketFactory.getAddress();
  console.log(`   ✅ MarketFactory: ${factoryAddress}`);

  // ============ 4. Post-deployment Configuration ============
  console.log("\n⚙️  Configuring contracts...");

  // Add USDC to stablecoin whitelist
  console.log("   Adding USDC to whitelist...");
  const addUsdcTx = await marketFactory.addStablecoin(config.usdc, 6);
  await addUsdcTx.wait();
  console.log(`   ✅ USDC whitelisted: ${config.usdc}`);

  // Authorize deployer as NFT oracle updater (for testing)
  console.log("   Authorizing NFT oracle updater...");
  const authTx = await nftOracle.authorizeUpdater(deployerAddress);
  await authTx.wait();
  console.log(`   ✅ Updater authorized: ${deployerAddress}`);

  // ============ 5. Deployment Summary ============
  const result: DeploymentResult = {
    loanImplementation: loanAddress,
    nftOracle: nftOracleAddress,
    marketFactory: factoryAddress,
    treasury,
    network: config.name,
    chainId,
    deployer: deployerAddress,
    timestamp: Date.now(),
  };

  console.log("\n" + "=".repeat(50));
  console.log("🎉 DEPLOYMENT COMPLETE!\n");
  console.log("📋 Contract Addresses:");
  console.log(`   LoanContract:   ${result.loanImplementation}`);
  console.log(`   NFTOracle:      ${result.nftOracle}`);
  console.log(`   MarketFactory:  ${result.marketFactory}`);
  console.log(`   Treasury:       ${result.treasury}`);
  console.log("\n📝 Save these addresses to your .env file!");
  console.log("=".repeat(50));

  // Save deployment to file
  const fs = await import("fs");
  const deploymentPath = `./deployments/${config.name.toLowerCase().replace(" ", "-")}.json`;
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments", { recursive: true });
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Deployment saved to: ${deploymentPath}`);

  return result;
}

// Verification helper
export async function verifyContracts(deployment: DeploymentResult) {
  console.log("\n🔍 Verifying contracts on block explorer...\n");

  const { run } = await import("hardhat");

  try {
    // Verify LoanContract
    console.log("Verifying LoanContract...");
    await run("verify:verify", {
      address: deployment.loanImplementation,
      constructorArguments: [],
    });

    // Verify NFTOracle
    console.log("Verifying NFTOracle...");
    const config = TESTNET_CONFIG[deployment.chainId];
    await run("verify:verify", {
      address: deployment.nftOracle,
      constructorArguments: [deployment.deployer, config.chainlinkEthUsd],
    });

    // Verify MarketFactory
    console.log("Verifying MarketFactory...");
    await run("verify:verify", {
      address: deployment.marketFactory,
      constructorArguments: [
        deployment.deployer,
        deployment.treasury,
        deployment.loanImplementation,
      ],
    });

    console.log("\n✅ All contracts verified!");
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
