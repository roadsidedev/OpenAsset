import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function main() {
  console.log("🚀 Starting End-to-End Simulation...");

  // 1. Setup Actors
  const [deployer, lp, borrower, liquidator] = await ethers.getSigners();
  console.log("");
  console.log("Actors:");
  console.log(`LP: ${lp.address}`);
  console.log(`Borrower: ${borrower.address}`);
  console.log(`Liquidator: ${liquidator.address}`);

  // 2. Deploy Infrastructure
  console.log("");
  console.log("--- Deploying Infrastructure ---");
  
  // Tokens
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const collateral = await MockERC20.deploy("GameToken", "GAME");
  const loanAsset = await MockERC20.deploy("USD Coin", "USDC");
  await collateral.waitForDeployment();
  await loanAsset.waitForDeployment();
  console.log(`Collateral (GAME): ${await collateral.getAddress()}`);
  console.log(`Loan Asset (USDC): ${await loanAsset.getAddress()}`);

  // Oracle
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  // Set price: 1 GAME = 10 USDC
  await oracle.setPrice(await collateral.getAddress(), ethers.parseEther("10"));
  console.log(`Oracle deployed. Price set: 1 GAME = 10 USDC`);

  // Market Factory
  const MarketFactory = await ethers.getContractFactory("MarketFactory");
  const factory = await MarketFactory.deploy();
  await factory.waitForDeployment();
  console.log(`Factory deployed: ${await factory.getAddress()}`);

  // 3. LP Creates Market
  console.log("");
  console.log("--- Step 1: LP Creates Market ---");
  const tx = await factory.connect(lp).createMarket(
    await collateral.getAddress(),
    await loanAsset.getAddress(),
    await oracle.getAddress(),
    7500, // 75% LTV
    86400 * 30, // 30 Days
    1000 // 10% Interest
  );
  await tx.wait();
  
  // Get Market Address from event
  // Simulating frontend indexing
  const marketAddress = await factory.allMarkets(0);
  console.log(`Market Deployed at: ${marketAddress}`);

  const market = await ethers.getContractAt("LendingMarket", marketAddress);

  // 4. LP Funds Market
  console.log("");
  console.log("--- Step 2: LP Funds Market ---");
  const liquidityAmount = ethers.parseEther("10000");
  await loanAsset.connect(lp).approve(marketAddress, liquidityAmount);
  // Mint to LP first (Mock logic)
  await loanAsset.mint(lp.address, liquidityAmount);
  
  await market.connect(lp).depositLiquidity(liquidityAmount);
  console.log("Liquidity Deposited: 10,000 USDC");

  // 5. Borrower Requests Loan
  console.log("");
  console.log("--- Step 3: Borrower Requests Loan ---");
  // Borrower needs collateral
  const collateralAmount = ethers.parseEther("100"); // 100 GAME
  await collateral.mint(borrower.address, collateralAmount);
  await collateral.connect(borrower).approve(marketAddress, collateralAmount);

  // 100 GAME * $10 = $1000 Value
  // Max Loan = $1000 * 75% = $750
  // Interest = $750 * 10% = $75
  // Total Repayment = $825
  
  await market.connect(borrower).requestLoan(collateralAmount);
  console.log("Loan Requested for 100 GAME");

  const loan = await market.loans(0);
  console.log(`Loan Principal: ${ethers.formatEther(loan.principalAmount)} USDC`);
  
  // Verify Borrower received funds
  const borrowerBal = await loanAsset.balanceOf(borrower.address);
  console.log(`Borrower USDC Balance: ${ethers.formatEther(borrowerBal)}`);

  // 7. Scenario B: Liquidation (Price Drop)
  console.log("");
  console.log("--- Step 4: Market Crash (Liquidation) ---");
  // Price drops to $5. Collateral Value = $500. Debt = $825 (Principal + Interest calc).
  // Health Factor < 1.
  
  console.log("Oracle Price dropping to $5...");
  await oracle.setPrice(await collateral.getAddress(), ethers.parseEther("5"));

  const isLiquidatable = await market.isLiquidatable(0);
  console.log(`Is Liquidatable? ${isLiquidatable}`);

  if (isLiquidatable) {
      console.log("Liquidating...");
      await market.connect(liquidator).liquidateLoan(0);
      console.log("Liquidation executed.");
      
      const loanInfo = await market.loans(0);
      console.log(`Loan Active? ${loanInfo.active}`);
      
      // Check LP balance (seized collateral)
      // LP started with 0 collateral (only minted USDC)
      const lpCollateral = await collateral.balanceOf(lp.address);
      console.log(`LP Seized Collateral: ${ethers.formatEther(lpCollateral)} GAME`);
      
      // Calculate expected seizure:
      // Debt: 750 + 75 = 825
      // Penalty: 5% of 825 = 41.25
      // Total: 866.25
      // Price: $5
      // Tokens needed: 866.25 / 5 = 173.25
      
      // Original Collateral: 100 GAME.
      // 173.25 > 100.
      // This is a BAD DEBT scenario (Underwater).
      // LP should get ALL 100 tokens.
      
      if (lpCollateral === ethers.parseEther("100")) {
          console.log("SUCCESS: Full collateral seized (Underwater scenario).");
      } else {
          console.log(`WARNING: Unexpected seizure amount: ${ethers.formatEther(lpCollateral)}`);
      }
  }

  console.log("");
  console.log("🚀 E2E Simulation Completed Successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});