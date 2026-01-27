import { ethers } from "hardhat";

/**
 * Create a test market on deployed MarketFactory
 * 
 * Usage:
 *   npx hardhat run scripts/create-test-market.ts --network sepolia
 */

// Load deployment addresses from environment or file
const DEPLOYMENTS: Record<number, {
  marketFactory: string;
  usdc: string;
  testToken: string;
  chainlinkFeed: string;
}> = {
  // Sepolia
  11155111: {
    marketFactory: process.env.SEPOLIA_MARKET_FACTORY || "",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    testToken: process.env.SEPOLIA_TEST_TOKEN || "",
    chainlinkFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  },
  // Base Sepolia
  84532: {
    marketFactory: process.env.BASE_SEPOLIA_MARKET_FACTORY || "",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    testToken: process.env.BASE_SEPOLIA_TEST_TOKEN || "",
    chainlinkFeed: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
  },
};

async function main() {
  console.log("\n🏗️  Creating Test Market\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const config = DEPLOYMENTS[chainId];
  if (!config || !config.marketFactory) {
    throw new Error("MarketFactory not deployed. Run deploy.ts first.");
  }

  console.log(`📍 Chain: ${chainId}`);
  console.log(`👤 Creator: ${await deployer.getAddress()}`);
  console.log(`🏭 Factory: ${config.marketFactory}`);

  // Get factory contract
  const factory = await ethers.getContractAt("MarketFactory", config.marketFactory);

  // Approve USDC for initial liquidity
  const usdc = await ethers.getContractAt("IERC20", config.usdc);
  const initialLiquidity = ethers.parseUnits("1000", 6); // 1000 USDC

  console.log("\n💰 Approving USDC...");
  const approveTx = await usdc.approve(config.marketFactory, initialLiquidity);
  await approveTx.wait();
  console.log("   ✅ Approved");

  // Create market parameters
  const marketParams = {
    collateralAsset: config.testToken || config.usdc, // Use USDC as collateral for testing
    loanAsset: config.usdc,
    assetType: 0, // ERC20
    oracleType: 1, // CHAINLINK
    primaryOracle: config.chainlinkFeed,
    nftOracle: ethers.ZeroAddress,
    ltvBps: 7500, // 75%
    aprBps: 1000, // 10%
    durationSeconds: 30 * 24 * 60 * 60, // 30 days
    initialLiquidity,
  };

  console.log("\n🏗️  Creating market...");
  console.log(`   Collateral: ${marketParams.collateralAsset}`);
  console.log(`   Loan Asset: ${marketParams.loanAsset}`);
  console.log(`   LTV: ${marketParams.ltvBps / 100}%`);
  console.log(`   APR: ${marketParams.aprBps / 100}%`);
  console.log(`   Duration: 30 days`);
  console.log(`   Initial Liquidity: ${ethers.formatUnits(initialLiquidity, 6)} USDC`);

  const tx = await factory.createMarket(
    marketParams.collateralAsset,
    marketParams.loanAsset,
    marketParams.assetType,
    marketParams.oracleType,
    marketParams.primaryOracle,
    marketParams.nftOracle,
    marketParams.ltvBps,
    marketParams.aprBps,
    marketParams.durationSeconds,
    marketParams.initialLiquidity
  );

  console.log("\n⏳ Waiting for confirmation...");
  const receipt = await tx.wait();

  // Find MarketCreated event
  const marketCreatedEvent = receipt?.logs.find((log: any) => {
    try {
      const parsed = factory.interface.parseLog(log);
      return parsed?.name === "MarketCreated";
    } catch {
      return false;
    }
  });

  if (marketCreatedEvent) {
    const parsed = factory.interface.parseLog(marketCreatedEvent);
    console.log(`\n✅ Market Created: ${parsed?.args.market}`);
  }

  console.log("\n🎉 Test market created successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
