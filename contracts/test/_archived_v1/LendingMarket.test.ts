import { expect } from "chai";
import { ethers } from "hardhat";
import { LendingMarket, MarketFactory, MockERC20, MockOracle } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LendingMarket Functional Tests", function () {
  let market: LendingMarket;
  let collateral: MockERC20;
  let loanAsset: MockERC20;
  let oracle: MockOracle;
  let owner: SignerWithAddress;
  let borrower: SignerWithAddress;
  let liquidator: SignerWithAddress;

  const LTV_BPS = 7500; // 75%
  const DURATION = 86400; // 1 day
  const RATE_BPS = 1000; // 10%
  const INITIAL_LIQUIDITY = ethers.parseEther("10000");
  const COLLATERAL_PRICE = ethers.parseEther("10"); // 1 COL = 10 USD

  beforeEach(async function () {
    [owner, borrower, liquidator] = await ethers.getSigners();

    // Deploy Tokens
    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    collateral = (await ERC20Factory.deploy("Collateral", "COL")) as MockERC20;
    loanAsset = (await ERC20Factory.deploy("USD Coin", "USDC")) as MockERC20;

    // Deploy Oracle
    const OracleFactory = await ethers.getContractFactory("MockOracle");
    oracle = (await OracleFactory.deploy()) as MockOracle;
    await oracle.setPrice(await collateral.getAddress(), COLLATERAL_PRICE);

    // Deploy Market directly for isolation
    const Market = await ethers.getContractFactory("LendingMarket");
    market = (await Market.deploy(
      owner.address,
      await collateral.getAddress(),
      await loanAsset.getAddress(),
      await oracle.getAddress(),
      LTV_BPS,
      DURATION,
      RATE_BPS
    )) as LendingMarket;

    // Fund Market
    await loanAsset.mint(owner.address, INITIAL_LIQUIDITY);
    await loanAsset.connect(owner).approve(await market.getAddress(), INITIAL_LIQUIDITY);
    await market.connect(owner).depositLiquidity(INITIAL_LIQUIDITY);

    // Fund Borrower
    await collateral.mint(borrower.address, ethers.parseEther("100"));
    await collateral.connect(borrower).approve(await market.getAddress(), ethers.parseEther("100"));
  });

  describe("Liquidity Management", function () {
    it("LP can withdraw liquidity", async function () {
      const withdrawAmount = ethers.parseEther("1000");
      await expect(market.connect(owner).withdrawLiquidity(withdrawAmount))
        .to.changeTokenBalances(
          loanAsset,
          [owner, market],
          [withdrawAmount, -withdrawAmount]
        );
    });

    it("Non-owner cannot withdraw liquidity", async function () {
      await expect(
        market.connect(borrower).withdrawLiquidity(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
    });
  });

  describe("Loan Lifecycle", function () {
    it("Borrower can request loan", async function () {
      const colAmount = ethers.parseEther("10"); // 10 COL * $10 = $100 Value
      // Max Loan = $100 * 75% = $75
      const expectedLoan = ethers.parseEther("75");

      await expect(market.connect(borrower).requestLoan(colAmount))
        .to.emit(market, "LoanRequested")
        .withArgs(0, borrower.address, colAmount, expectedLoan);

      // Verify balances
      expect(await collateral.balanceOf(await market.getAddress())).to.equal(colAmount);
      expect(await loanAsset.balanceOf(borrower.address)).to.equal(expectedLoan);
    });

    it("Borrower can repay loan", async function () {
      const colAmount = ethers.parseEther("10");
      await market.connect(borrower).requestLoan(colAmount);
      
      const loanId = 0;
      const loanDetails = await market.loans(loanId);
      const principal = loanDetails.principalAmount;
      const interest = (principal * BigInt(RATE_BPS)) / 10000n;
      const totalRepay = principal + interest;

      // Fund borrower with enough USDC to repay (mint extra for interest)
      await loanAsset.mint(borrower.address, interest);
      await loanAsset.connect(borrower).approve(await market.getAddress(), totalRepay);

      await expect(market.connect(borrower).repayLoan(loanId))
        .to.emit(market, "LoanRepaid")
        .withArgs(loanId, borrower.address);

      // Verify collateral returned
      expect(await collateral.balanceOf(borrower.address)).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Liquidation", function () {
    const colAmount = ethers.parseEther("10"); // $100 value
    
    beforeEach(async function () {
        await market.connect(borrower).requestLoan(colAmount);
    });

    it("Should not allow liquidation if healthy and not expired", async function () {
        await expect(
            market.connect(liquidator).liquidateLoan(0)
        ).to.be.revertedWith("Loan not liquidatable");
    });

    it("Should liquidate if expired", async function () {
        // Fast forward time
        await time.increase(DURATION + 1);

        const tx = market.connect(liquidator).liquidateLoan(0);

        await expect(tx)
            .to.emit(market, "Liquidated")
            .withArgs(0, liquidator.address);

        // Principal: 75
        // Interest (10%): 7.5
        // Debt: 82.5
        // Penalty (5%): 4.125
        // Total Owed Value: 86.625
        // Price: 10
        // Seized: 8.6625
        const expectedSeized = ethers.parseEther("8.6625");
        const expectedReturned = ethers.parseEther("1.3375");

        await expect(tx).to.changeTokenBalance(collateral, owner, expectedSeized);
        await expect(tx).to.changeTokenBalance(collateral, borrower, expectedReturned);
    });

    it("Should liquidate if underwater (price drop)", async function () {
        // Price drops from $10 to $5
        // Collateral Value = 10 * 5 = $50
        // Loan Principal = $75
        // $50 < $75 -> Liquidatable
        await oracle.setPrice(await collateral.getAddress(), ethers.parseEther("5"));

        expect(await market.isLiquidatable(0)).to.be.true;

        await expect(market.connect(liquidator).liquidateLoan(0))
            .to.emit(market, "Liquidated");
    });
  });
});
