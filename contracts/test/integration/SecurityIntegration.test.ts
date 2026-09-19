import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Phase 6: Security & Integration Tests", function () {
  let owner: HardhatEthersSigner;
  let lp: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let liquidator: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  const LTV = 5000;
  const APR = 1200;
  const DURATION = 30 * 24 * 60 * 60;
  const GRACE_PERIOD = 1;
  const INITIAL_PRICE = ethers.parseEther("2000");
  const DEPOSIT_AMOUNT = ethers.parseEther("100000");

  let mockToken: any;
  let lendingToken: any;

  async function deployMarket(overrides: any = {}) {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mToken = await MockERC20.deploy("Mock Token", "MTK", 18);
    const lToken = await MockERC20.deploy("USD Coin", "USDC", 18);

    const MockAssetAdapter = await ethers.getContractFactory("MockAssetAdapter");
    const assetAdapter = overrides.assetAdapter || await MockAssetAdapter.deploy(await mToken.getAddress());

    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    const oracleAdapter = overrides.oracleAdapter || await MockOracleAdapter.deploy(INITIAL_PRICE, true);

    const MockComplianceAdapter = await ethers.getContractFactory("MockComplianceAdapter");
    const complianceAdapter = overrides.complianceAdapter || await MockComplianceAdapter.deploy(true);

    const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
    const liquidationAdapter = overrides.liquidationAdapter || await MockLiquidationAdapter.deploy(false, 0);

    const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
    const positionAdapter = overrides.positionAdapter || await MockPositionAdapter.deploy();

    const LendingMarketV2 = await ethers.getContractFactory("LendingMarketV2");
    const market = await LendingMarketV2.deploy(owner.address);
    await market.waitForDeployment();
    await market.connect(owner).initialize({
      factory: ethers.ZeroAddress,
      marketOwner: owner.address,
      collateralAsset: await mToken.getAddress(),
      lendingAsset: await lToken.getAddress(),
      protocolTreasury: treasury.address,
      assetAdapter: await assetAdapter.getAddress(),
      oracleAdapter: await oracleAdapter.getAddress(),
      complianceAdapter: overrides.useCompliance ? await complianceAdapter.getAddress() : ethers.ZeroAddress,
      liquidationAdapter: await liquidationAdapter.getAddress(),
      positionAdapter: await positionAdapter.getAddress(),
      ltvBps: LTV,
      aprBps: APR,
      durationSeconds: DURATION,
      gracePeriodHours: GRACE_PERIOD,
      enableHealthFactor: true,
      healthFactorThreshold: 12000,
      cbConfig: { enabled: true, pauseThresholdBps: 2000, lookbackPeriodSeconds: 3600, resumeThresholdBps: 1000, cooldownSeconds: 7200 },
    });

    // Fund signers
    await mToken.mint(borrower.address, ethers.parseEther("10000000"));
    await lToken.mint(lp.address, ethers.parseEther("10000000"));
    await lToken.mint(borrower.address, ethers.parseEther("10000000"));
    await mToken.connect(borrower).approve(await assetAdapter.getAddress(), ethers.MaxUint256);
    await lToken.connect(lp).approve(await market.getAddress(), ethers.MaxUint256);
    await lToken.connect(borrower).approve(await market.getAddress(), ethers.MaxUint256);

    // Store references for cleanup
    mockToken = mToken;
    lendingToken = lToken;

    await market.connect(lp).depositLiquidity(DEPOSIT_AMOUNT);

    return { market, mockToken: mToken, lendingToken: lToken, assetAdapter, oracleAdapter, complianceAdapter, liquidationAdapter, positionAdapter };
  }

  before(async function () {
    [owner, lp, borrower, liquidator, treasury] = await ethers.getSigners();
  });

  // ===================================================================
  // ADVERSARIAL ADAPTER TESTS
  // ===================================================================
  describe("Adversarial Adapter Tests", function () {
    it("reject loan when oracle returns zero price", async function () {
      const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
      const badOracle = await MockOracleAdapter.deploy(0, true);
      const { market } = await deployMarket({ oracleAdapter: badOracle });

      await expect(
        market.connect(borrower).requestLoan(ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(market, "OraclePriceOutOfBounds");
    });

    it("reject loan when oracle is untrusted (circuit breaker pauses)", async function () {
      const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
      const untrustedOracle = await MockOracleAdapter.deploy(INITIAL_PRICE, false);
      const { market } = await deployMarket({ oracleAdapter: untrustedOracle });

      await expect(
        market.connect(borrower).requestLoan(ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(market, "MarketNotActive");
    });

    it("reject loan when compliance reverts (fail-closed)", async function () {
      const MockComplianceAdapter = await ethers.getContractFactory("MockComplianceAdapter");
      const revertingCompliance = await MockComplianceAdapter.deploy(true);
      await revertingCompliance.setRevert(true, "down");
      const { market } = await deployMarket({ complianceAdapter: revertingCompliance, useCompliance: true });

      await expect(
        market.connect(borrower).requestLoan(ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(market, "NotBorrower");
    });

    it("reject loan when compliance says ineligible", async function () {
      const MockComplianceAdapter = await ethers.getContractFactory("MockComplianceAdapter");
      const denyCompliance = await MockComplianceAdapter.deploy(false);
      const { market } = await deployMarket({ complianceAdapter: denyCompliance, useCompliance: true });

      await expect(
        market.connect(borrower).requestLoan(ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(market, "NotBorrower");
    });

    it("reject loan when collateral exceeds available liquidity", async function () {
      const { market, mockToken: m } = await deployMarket();
      const tooMuch = ethers.parseEther("10000000");
      await m.mint(borrower.address, tooMuch);

      await expect(
        market.connect(borrower).requestLoan(tooMuch)
      ).to.be.reverted;
    });
  });

  // ===================================================================
  // ASYNC LIQUIDATION FULL-CYCLE TESTS
  // ===================================================================
  describe("Async Liquidation Full-Cycle Tests", function () {
    it("enter LIQUIDATION_CURE for async adapter", async function () {
      const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
      const asyncLiq = await MockLiquidationAdapter.deploy(true, 3600);
      const { market } = await deployMarket({ liquidationAdapter: asyncLiq });

      await market.connect(borrower).requestLoan(ethers.parseEther("10"));
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");

      await market.connect(liquidator).liquidate(0);
      const loan = await market.loans(0);
      expect(loan.status).to.equal(2);
      expect(loan.frozenInterestAt).to.be.gt(0);
    });

    it("repay during LIQUIDATION_CURE with penalty", async function () {
      const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
      const asyncLiq = await MockLiquidationAdapter.deploy(true, 3600);
      const { market, lendingToken: lt } = await deployMarket({ liquidationAdapter: asyncLiq });

      await market.connect(borrower).requestLoan(ethers.parseEther("10"));

      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");

      await market.connect(liquidator).liquidate(0);
      expect((await market.loans(0)).status).to.equal(2);

      // Calculate total debt with penalty
      const loanDetails = await market.getLoanDetails(0);
      const principal = BigInt(loanDetails.principal.toString());
      const interest = (principal * BigInt(APR)) / 10000n;
      const penalty = (principal * 500n) / 10000n;
      const totalOwed = principal + interest + penalty;

      await lt.connect(borrower).approve(await market.getAddress(), totalOwed);
      await market.connect(borrower).repay(0);
      expect((await market.loans(0)).status).to.equal(4);
    });

    it("revert settleLiquidation if cure window still open", async function () {
      const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
      const asyncLiq = await MockLiquidationAdapter.deploy(true, 86400);
      const { market } = await deployMarket({ liquidationAdapter: asyncLiq });

      await market.connect(borrower).requestLoan(ethers.parseEther("10"));
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");

      await market.connect(liquidator).liquidate(0);

      await expect(
        market.connect(liquidator).settleLiquidation(0)
      ).to.be.revertedWithCustomError(market, "CureWindowStillOpen");
    });

    it("settleLiquidation after cure window expires", async function () {
      const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
      const asyncLiq = await MockLiquidationAdapter.deploy(true, 100);
      await asyncLiq.setMockReturns(ethers.parseEther("500"), 0);
      const { market } = await deployMarket({ liquidationAdapter: asyncLiq });

      await market.connect(borrower).requestLoan(ethers.parseEther("10"));
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");

      await market.connect(liquidator).liquidate(0);
      expect((await market.loans(0)).status).to.equal(2);

      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine");

      await market.connect(liquidator).settleLiquidation(0);
      expect((await market.loans(0)).status).to.equal(5);
    });
  });

  // ===================================================================
  // POSITION TRANSFER TESTS
  // ===================================================================
  describe("Position Transfer Tests", function () {
    it("track position holder", async function () {
      const { market } = await deployMarket();
      await market.connect(borrower).requestLoan(ethers.parseEther("10"));
      const details = await market.getLoanDetails(0);
      expect(details.positionHolder).to.equal(borrower.address);
    });

    it("transfer position updates holder", async function () {
      const { market, positionAdapter } = await deployMarket();
      await market.connect(borrower).requestLoan(ethers.parseEther("10"));
      await positionAdapter.transferPosition(0, liquidator.address);
      const details = await market.getLoanDetails(0);
      expect(details.positionHolder).to.equal(liquidator.address);
    });

    it("collateral returns to current position holder on repay", async function () {
      const { market, positionAdapter } = await deployMarket();
      await market.connect(borrower).requestLoan(ethers.parseEther("10"));
      await positionAdapter.transferPosition(0, liquidator.address);
      await market.connect(borrower).repay(0);
      expect((await market.loans(0)).status).to.equal(4);
    });
  });

  // ===================================================================
  // FULL LIFECYCLE INTEGRATION
  // ===================================================================
  describe("Full Lifecycle Integration", function () {
    it("deploy → deposit → borrow → health check → repay", async function () {
      const { market, oracleAdapter } = await deployMarket();

      expect((await market.getMarketStats())._totalLiquidity).to.equal(DEPOSIT_AMOUNT);
      await market.connect(borrower).requestLoan(ethers.parseEther("10"));
      expect((await market.getMarketStats()).activeLoans).to.equal(1);

      const hf = await market.getHealthFactor(0);
      expect(hf).to.be.gt(0);

      await oracleAdapter.setPrice(ethers.parseEther("1000"));
      expect(await market.getHealthFactor(0)).to.be.lt(hf);

      await market.connect(borrower).repay(0);
      expect((await market.getMarketStats()).activeLoans).to.equal(0);
      expect((await market.loans(0)).status).to.equal(4);
    });

    it("deploy → deposit → borrow → expire → liquidate", async function () {
      const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
      const syncLiq = await MockLiquidationAdapter.deploy(false, 0);
      await syncLiq.setMockReturns(ethers.parseEther("500"), ethers.parseEther("50"));
      const { market } = await deployMarket({ liquidationAdapter: syncLiq });

      await market.connect(borrower).requestLoan(ethers.parseEther("10"));
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");

      await market.connect(liquidator).liquidate(0);
      expect((await market.loans(0)).status).to.equal(5);
      expect((await market.getMarketStats()).activeLoans).to.equal(0);
    });

    it("circuit breaker triggers on oracle untrusted", async function () {
      const { market, oracleAdapter } = await deployMarket();
      expect(await market.status()).to.equal(0);

      await oracleAdapter.setTrusted(false);
      await expect(
        market.connect(borrower).requestLoan(ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(market, "MarketNotActive");
    });
  });
});
