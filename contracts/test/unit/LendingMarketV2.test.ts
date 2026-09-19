import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("LendingMarketV2", function () {
  let owner: HardhatEthersSigner;
  let lp: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  let mockToken: any; // Collateral ERC20
  let lendingToken: any; // Lending stablecoin
  let assetAdapter: any;
  let oracleAdapter: any;
  let complianceAdapter: any;
  let liquidationAdapter: any;
  let positionAdapter: any;
  let market: any;

  const LTV = 5000; // 50% (gives health factor ~180%, well above 120% threshold)
  const APR = 1200; // 12%
  const DURATION = 30 * 24 * 60 * 60; // 30 days
  const GRACE_PERIOD = 1; // 1 hour
  const INITIAL_PRICE = ethers.parseEther("2000"); // $2000 per token
  const DEPOSIT_AMOUNT = ethers.parseEther("100000"); // 100000 tokens (enough for max loan of 15000)

  beforeEach(async function () {
    [owner, lp, borrower, treasury] = await ethers.getSigners();

    // Deploy mock tokens (both 18 decimals for simplicity)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK", 18);
    lendingToken = await MockERC20.deploy("USD Coin", "USDC", 18);

    // Deploy mock adapters
    const MockAssetAdapter = await ethers.getContractFactory("MockAssetAdapter");
    assetAdapter = await MockAssetAdapter.deploy(await mockToken.getAddress());

    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    oracleAdapter = await MockOracleAdapter.deploy(INITIAL_PRICE, true);

    const MockComplianceAdapter = await ethers.getContractFactory("MockComplianceAdapter");
    complianceAdapter = await MockComplianceAdapter.deploy(true); // all eligible

    const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
    liquidationAdapter = await MockLiquidationAdapter.deploy(false, 0); // sync, no cure window

    const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
    positionAdapter = await MockPositionAdapter.deploy();

    // Deploy LendingMarketV2 implementation; owner is deployer so initialize is allowed
    const LendingMarketV2 = await ethers.getContractFactory("LendingMarketV2");
    market = await LendingMarketV2.deploy(owner.address);
    await market.waitForDeployment();
    await market.connect(owner).initialize({
      factory: ethers.ZeroAddress,
      marketOwner: owner.address,
      collateralAsset: await mockToken.getAddress(),
      lendingAsset: await lendingToken.getAddress(),
      protocolTreasury: treasury.address,
      assetAdapter: await assetAdapter.getAddress(),
      oracleAdapter: await oracleAdapter.getAddress(),
      complianceAdapter: ethers.ZeroAddress,
      liquidationAdapter: await liquidationAdapter.getAddress(),
      positionAdapter: await positionAdapter.getAddress(),
      ltvBps: LTV,
      aprBps: APR,
      durationSeconds: DURATION,
      gracePeriodHours: GRACE_PERIOD,
      enableHealthFactor: true,
      healthFactorThreshold: 12000,
      cbConfig: {
        enabled: true,
        pauseThresholdBps: 2000,
        lookbackPeriodSeconds: 3600,
        resumeThresholdBps: 1000,
        cooldownSeconds: 7200,
      }
    });

    // Mint tokens
    await mockToken.mint(borrower.address, ethers.parseEther("100000"));
    await lendingToken.mint(lp.address, ethers.parseEther("1000000"));
    await lendingToken.mint(borrower.address, ethers.parseEther("100000"));

    // Approvals
    await mockToken.connect(borrower).approve(await assetAdapter.getAddress(), ethers.MaxUint256);
    await lendingToken.connect(lp).approve(await market.getAddress(), ethers.MaxUint256);
    await lendingToken.connect(borrower).approve(await market.getAddress(), ethers.MaxUint256);
  });

  describe("Liquidity Management", function () {
    it("should deposit liquidity and mint LP shares", async function () {
      await market.connect(lp).depositLiquidity(DEPOSIT_AMOUNT);

      const stats = await market.getMarketStats();
      expect(stats._totalLiquidity).to.equal(DEPOSIT_AMOUNT);
      expect(stats._availableLiquidity).to.equal(DEPOSIT_AMOUNT);
    });

    it("should withdraw liquidity", async function () {
      await market.connect(lp).depositLiquidity(DEPOSIT_AMOUNT);

      // Get the LP token balance (shares) and withdraw all
      const lpTokenAddress = await market.lpToken();
      const LPToken = await ethers.getContractAt("LPTokenV2", lpTokenAddress);
      const shares = await LPToken.balanceOf(lp.address);
      await market.connect(lp).withdrawLiquidity(shares);

      const stats = await market.getMarketStats();
      expect(stats._totalLiquidity).to.equal(0);
      expect(stats._availableLiquidity).to.equal(0);
    });
  });

  describe("Loan Lifecycle", function () {
    beforeEach(async function () {
      await market.connect(lp).depositLiquidity(DEPOSIT_AMOUNT);
    });

    it("should create a loan", async function () {
      const collateralAmount = ethers.parseEther("10"); // 10 tokens
      const tx = await market.connect(borrower).requestLoan(collateralAmount);
      const receipt = await tx.wait();

      // Check loan was created
      const loan = await market.loans(0);
      expect(loan.collateralAmount).to.equal(collateralAmount);
      expect(loan.status).to.equal(0); // ACTIVE

      // Check stats
      const stats = await market.getMarketStats();
      expect(stats.activeLoans).to.equal(1);
      expect(stats._totalBorrowed).to.be.gt(0);
    });

    it("should create a loan with a selected principal below the maximum", async function () {
      const collateralAmount = ethers.parseEther("10");
      const requestedPrincipal = ethers.parseEther("1234");
      await market.connect(borrower)["requestLoan(uint256,uint256)"](collateralAmount, requestedPrincipal);

      const loan = await market.loans(0);
      expect(loan.principal).to.equal(requestedPrincipal);
    });

    it("normalizes 8-decimal B20 collateral into 6-decimal USDC units", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const b20Token = await MockERC20.deploy("B20 AAPL", "AAPLc", 8);
      const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
      const Asset = await ethers.getContractFactory("ERC20Adapter");
      const b20Adapter = await Asset.deploy(owner.address);
      const Oracle = await ethers.getContractFactory("MockOracleAdapter");
      const b20Oracle = await Oracle.deploy(ethers.parseEther("2000"), true);
      const Liquidation = await ethers.getContractFactory("MockLiquidationAdapter");
      const b20Liquidation = await Liquidation.deploy(false, 0);
      const Position = await ethers.getContractFactory("MockPositionAdapter");
      const b20Position = await Position.deploy();
      const Market = await ethers.getContractFactory("LendingMarketV2");
      const b20Market = await Market.deploy(owner.address);
      await b20Market.waitForDeployment();
      await b20Market.initialize({
        factory: owner.address,
        marketOwner: owner.address,
        collateralAsset: b20Token.target,
        lendingAsset: usdc.target,
        protocolTreasury: treasury.address,
        assetAdapter: b20Adapter.target,
        oracleAdapter: b20Oracle.target,
        complianceAdapter: ethers.ZeroAddress,
        liquidationAdapter: b20Liquidation.target,
        positionAdapter: b20Position.target,
        ltvBps: 5000,
        aprBps: 1200,
        durationSeconds: DURATION,
        gracePeriodHours: GRACE_PERIOD,
        enableHealthFactor: true,
        healthFactorThreshold: 12000,
        cbConfig: { enabled: false, pauseThresholdBps: 0, lookbackPeriodSeconds: 0, resumeThresholdBps: 0, cooldownSeconds: 0 },
      });
      await b20Adapter.configure(b20Market.target, b20Token.target);
      await usdc.mint(lp.address, ethers.parseUnits("1000", 6));
      await usdc.connect(lp).approve(b20Market.target, ethers.parseUnits("1000", 6));
      await b20Market.connect(lp).depositLiquidity(ethers.parseUnits("1000", 6));
      await b20Token.mint(borrower.address, 10n ** 8n);
      await b20Token.connect(borrower).approve(b20Adapter.target, ethers.MaxUint256);

      await b20Market.connect(borrower)["requestLoan(uint256,uint256)"](10n ** 8n, ethers.parseUnits("500", 6));

      const loan = await b20Market.loans(0);
      expect(loan.principal).to.equal(ethers.parseUnits("500", 6));
      expect(await b20Token.balanceOf(b20Market.target)).to.equal(10n ** 8n);
    });

    it("should reject a selected principal above the oracle-valued maximum", async function () {
      const collateralAmount = ethers.parseEther("10");
      const maxPrincipal = ethers.parseEther("10000");
      await expect(
        market.connect(borrower)["requestLoan(uint256,uint256)"](collateralAmount, maxPrincipal + 1n),
      ).to.be.revertedWithCustomError(market, "InvalidLoanSize");
    });

    it("should repay a loan", async function () {
      const collateralAmount = ethers.parseEther("10");
      await market.connect(borrower).requestLoan(collateralAmount);

      // Get the loan details to calculate repayment
      const loan = await market.loans(0);
      const totalDebt = loan.principal + (loan.principal * BigInt(APR)) / BigInt(10000);

      // Repay
      await market.connect(borrower).repay(0);

      const loanAfter = await market.loans(0);
      expect(loanAfter.status).to.equal(4); // REPAID
    });

    it("should liquidate an expired loan", async function () {
      const collateralAmount = ethers.parseEther("10");
      await market.connect(borrower).requestLoan(collateralAmount);

      // Fast forward past expiry
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");

      // Mock liquidation adapter is non-transferring in unit tests — set 0,0 to pass enterprise balance-delta check
      // (real DEX adapter transfers; mock just returns values for status testing)
      await liquidationAdapter.setMockReturns(0, 0);

      // Liquidate (expired loan; mock returns 0 recovery)
      await market.connect(owner).liquidate(0);

      const loan = await market.loans(0);
      expect(loan.status).to.equal(5); // LIQUIDATED
    });

    it("should revert liquidation before expiry", async function () {
      const collateralAmount = ethers.parseEther("10");
      await market.connect(borrower).requestLoan(collateralAmount);

      await expect(
        market.connect(owner).liquidate(0)
      ).to.be.revertedWithCustomError(market, "NotLiquidatable");
    });

    it("should not liquidate an active loan when the oracle is untrusted", async function () {
      const collateralAmount = ethers.parseEther("10");
      await market.connect(borrower).requestLoan(collateralAmount);
      await oracleAdapter.setTrusted(false);

      await expect(
        market.connect(owner).liquidate(0),
      ).to.be.revertedWithCustomError(market, "NotLiquidatable");
    });
  });

  describe("Circuit Breaker", function () {
    it("should pause on oracle untrusted", async function () {
      await market.connect(lp).depositLiquidity(DEPOSIT_AMOUNT);

      // Set oracle to untrusted
      await oracleAdapter.setTrusted(false);

      // Try to create a loan (should fail — market pauses via circuit breaker)
      const collateralAmount = ethers.parseEther("10");
      await expect(
        market.connect(borrower).requestLoan(collateralAmount)
      ).to.be.revertedWithCustomError(market, "MarketNotActive");
    });
  });

  describe("Admin", function () {
    it("should pause and unpause", async function () {
      await market.connect(owner).pause();
      expect(await market.status()).to.equal(3); // PAUSED_MANUAL

      await market.connect(owner).unpause();
      expect(await market.status()).to.equal(0); // ACTIVE
    });
  });
});
