import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("MarketFactoryV2", function () {
  let owner: HardhatEthersSigner;
  let lp: HardhatEthersSigner;
  let governance: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  let registry: any;
  let factory: any;
  let mockToken: any;
  let lendingToken: any;

  const LTV = 7500;
  const APR = 1200;
  const DURATION = 30 * 24 * 60 * 60;
  const GRACE_PERIOD = 1;
  const INITIAL_PRICE = ethers.parseEther("2000");
  const DEPOSIT_AMOUNT = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, lp, governance, treasury] = await ethers.getSigners();

    // Deploy registry
    const Registry = await ethers.getContractFactory("AdapterRegistry");
    registry = await Registry.deploy(governance.address);

    // Deploy factory
    const Factory = await ethers.getContractFactory("MarketFactoryV2");
    factory = await Factory.deploy(owner.address, treasury.address, await registry.getAddress());

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK", 18);
    lendingToken = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Add lending asset to allowlist
    await factory.connect(owner).addLendingAsset(await lendingToken.getAddress());

    // Deploy and register mock adapters
    const MockAssetAdapter = await ethers.getContractFactory("MockAssetAdapter");
    const assetAdapter = await MockAssetAdapter.deploy(await mockToken.getAddress());
    await registry.connect(governance).registerAdapter(await assetAdapter.getAddress(), 0);
    await registry.connect(governance).markVerified(await assetAdapter.getAddress(), "Audit #1");

    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    const oracleAdapter = await MockOracleAdapter.deploy(INITIAL_PRICE, true);
    await registry.connect(governance).registerAdapter(await oracleAdapter.getAddress(), 1);
    await registry.connect(governance).markVerified(await oracleAdapter.getAddress(), "Audit #1");

    const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
    const liquidationAdapter = await MockLiquidationAdapter.deploy(false, 0);
    await registry.connect(governance).registerAdapter(await liquidationAdapter.getAddress(), 3);
    await registry.connect(governance).markVerified(await liquidationAdapter.getAddress(), "Audit #1");

    const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
    const positionAdapter = await MockPositionAdapter.deploy();
    await registry.connect(governance).registerAdapter(await positionAdapter.getAddress(), 4);
    await registry.connect(governance).markVerified(await positionAdapter.getAddress(), "Audit #1");

    // Mint tokens for LP
    await lendingToken.mint(lp.address, ethers.parseEther("1000000"));

    // Store adapter addresses for use in tests
    (this as any).assetAdapter = assetAdapter;
    (this as any).oracleAdapter = oracleAdapter;
    (this as any).liquidationAdapter = liquidationAdapter;
    (this as any).positionAdapter = positionAdapter;
  });

  describe("Lending Asset Allowlist", function () {
    it("should add and remove lending assets", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const newToken = await MockERC20.deploy("New Token", "NEW", 18);

      await factory.connect(owner).addLendingAsset(await newToken.getAddress());
      expect(await factory.isAllowedLendingAsset(await newToken.getAddress())).to.be.true;

      await factory.connect(owner).removeLendingAsset(await newToken.getAddress());
      expect(await factory.isAllowedLendingAsset(await newToken.getAddress())).to.be.false;
    });
  });

  describe("Market Creation", function () {
    it("should create a market with valid config", async function () {
      const assetAdapter = (this as any).assetAdapter;
      const oracleAdapter = (this as any).oracleAdapter;
      const liquidationAdapter = (this as any).liquidationAdapter;
      const positionAdapter = (this as any).positionAdapter;

      const config = {
        lpAddress: lp.address,
        collateralAsset: await mockToken.getAddress(),
        assetAdapter: await assetAdapter.getAddress(),
        oracleAdapter: await oracleAdapter.getAddress(),
        complianceAdapter: ethers.ZeroAddress,
        liquidationAdapter: await liquidationAdapter.getAddress(),
        positionAdapter: await positionAdapter.getAddress(),
        lendingAsset: await lendingToken.getAddress(),
        ltvBasisPoints: LTV,
        aprBasisPoints: APR,
        durationSeconds: DURATION,
        gracePeriodHours: GRACE_PERIOD,
        enableHealthFactor: true,
        healthFactorThreshold: 12000,
        enableCircuitBreaker: true,
        pauseThresholdBps: 2000,
        lookbackPeriodSeconds: 3600,
        resumeThresholdBps: 1000,
        cooldownSeconds: 7200,
      };

      // Approve lending tokens to factory
      await lendingToken.connect(lp).approve(await factory.getAddress(), DEPOSIT_AMOUNT);

      const tx = await factory.connect(lp).createMarket(config, { value: DEPOSIT_AMOUNT });
      const receipt = await tx.wait();

      expect(await factory.getMarketCount()).to.equal(1);
    });

    it("should revert with invalid LTV", async function () {
      const assetAdapter = (this as any).assetAdapter;
      const oracleAdapter = (this as any).oracleAdapter;
      const liquidationAdapter = (this as any).liquidationAdapter;
      const positionAdapter = (this as any).positionAdapter;

      const config = {
        lpAddress: lp.address,
        collateralAsset: await mockToken.getAddress(),
        assetAdapter: await assetAdapter.getAddress(),
        oracleAdapter: await oracleAdapter.getAddress(),
        complianceAdapter: ethers.ZeroAddress,
        liquidationAdapter: await liquidationAdapter.getAddress(),
        positionAdapter: await positionAdapter.getAddress(),
        lendingAsset: await lendingToken.getAddress(),
        ltvBasisPoints: 10000, // 100% - invalid
        aprBasisPoints: APR,
        durationSeconds: DURATION,
        gracePeriodHours: GRACE_PERIOD,
        enableHealthFactor: true,
        healthFactorThreshold: 12000,
        enableCircuitBreaker: true,
        pauseThresholdBps: 2000,
        lookbackPeriodSeconds: 3600,
        resumeThresholdBps: 1000,
        cooldownSeconds: 7200,
      };

      await expect(
        factory.connect(lp).createMarket(config, { value: DEPOSIT_AMOUNT })
      ).to.be.revertedWith("LTV must be 1-95%");
    });

    it("should revert with disallowed lending asset", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const badToken = await MockERC20.deploy("Bad Token", "BAD", 18);

      const assetAdapter = (this as any).assetAdapter;
      const oracleAdapter = (this as any).oracleAdapter;
      const liquidationAdapter = (this as any).liquidationAdapter;
      const positionAdapter = (this as any).positionAdapter;

      const config = {
        lpAddress: lp.address,
        collateralAsset: await mockToken.getAddress(),
        assetAdapter: await assetAdapter.getAddress(),
        oracleAdapter: await oracleAdapter.getAddress(),
        complianceAdapter: ethers.ZeroAddress,
        liquidationAdapter: await liquidationAdapter.getAddress(),
        positionAdapter: await positionAdapter.getAddress(),
        lendingAsset: await badToken.getAddress(),
        ltvBasisPoints: LTV,
        aprBasisPoints: APR,
        durationSeconds: DURATION,
        gracePeriodHours: GRACE_PERIOD,
        enableHealthFactor: true,
        healthFactorThreshold: 12000,
        enableCircuitBreaker: true,
        pauseThresholdBps: 2000,
        lookbackPeriodSeconds: 3600,
        resumeThresholdBps: 1000,
        cooldownSeconds: 7200,
      };

      await expect(
        factory.connect(lp).createMarket(config, { value: DEPOSIT_AMOUNT })
      ).to.be.revertedWithCustomError(factory, "LendingAssetNotAllowed");
    });

    it("should revert with deprecated adapter", async function () {
      const assetAdapter = (this as any).assetAdapter;

      // Deprecate the asset adapter
      await registry.connect(governance).markDeprecated(await assetAdapter.getAddress(), "Test deprecation");

      const oracleAdapter = (this as any).oracleAdapter;
      const liquidationAdapter = (this as any).liquidationAdapter;
      const positionAdapter = (this as any).positionAdapter;

      const config = {
        lpAddress: lp.address,
        collateralAsset: await mockToken.getAddress(),
        assetAdapter: await assetAdapter.getAddress(),
        oracleAdapter: await oracleAdapter.getAddress(),
        complianceAdapter: ethers.ZeroAddress,
        liquidationAdapter: await liquidationAdapter.getAddress(),
        positionAdapter: await positionAdapter.getAddress(),
        lendingAsset: await lendingToken.getAddress(),
        ltvBasisPoints: LTV,
        aprBasisPoints: APR,
        durationSeconds: DURATION,
        gracePeriodHours: GRACE_PERIOD,
        enableHealthFactor: true,
        healthFactorThreshold: 12000,
        enableCircuitBreaker: true,
        pauseThresholdBps: 2000,
        lookbackPeriodSeconds: 3600,
        resumeThresholdBps: 1000,
        cooldownSeconds: 7200,
      };

      await expect(
        factory.connect(lp).createMarket(config, { value: DEPOSIT_AMOUNT })
      ).to.be.revertedWith("Asset adapter not selectable");
    });
  });

  describe("View Functions", function () {
    it("should return factory stats", async function () {
      const stats = await factory.getFactoryStats();
      expect(stats.totalMarkets).to.equal(0);
      expect(stats.totalLendingAssets).to.equal(1);
      expect(stats._protocolTreasury).to.equal(treasury.address);
    });

    it("should return allowed lending assets", async function () {
      const assets = await factory.getAllowedLendingAssets();
      expect(assets.length).to.equal(1);
      expect(assets[0]).to.equal(await lendingToken.getAddress());
    });
  });
});
