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

    // Deploy MarketDeployer (clone pattern: template + deployer)
    const MarketImpl = await ethers.getContractFactory("LendingMarketV2");
    const marketTemplate = await MarketImpl.deploy();
    await marketTemplate.waitForDeployment();
    const Deployer = await ethers.getContractFactory("MarketDeployer");
    const deployer = await Deployer.deploy(await marketTemplate.getAddress());

    // Deploy factory with the deployer
    const Factory = await ethers.getContractFactory("MarketFactoryV2");
    factory = await Factory.deploy(owner.address, treasury.address, await registry.getAddress(), await deployer.getAddress());

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

      const tx = await factory.connect(lp).createMarket(config, DEPOSIT_AMOUNT);
      const receipt = await tx.wait();

      expect(await factory.getMarketCount()).to.equal(1);
    });

    it("should atomically register B20 feed and policy token, and roll back invalid sequencer setup", async function () {
      const B20 = await ethers.getContractFactory("MockB20");
      const b20 = await B20.deploy("Mock B20 AAPL", "AAPLc");
      const Feed = await ethers.getContractFactory("MockChainlinkFeed");
      const feed = await Feed.deploy(2000n * 10n ** 8n, 8, 1);
      const B20Asset = await ethers.getContractFactory("B20AssetAdapter");
      const b20Asset = await B20Asset.deploy(await factory.getAddress(), await registry.getAddress());
      const Equity = await ethers.getContractFactory("ChainlinkEquityFeedAdapter");
      const equity = await Equity.deploy(await factory.getAddress());
      const Compliance = await ethers.getContractFactory("B20PolicyComplianceAdapter");
      const compliance = await Compliance.deploy(await factory.getAddress(), await registry.getAddress());
      const B20Configurator = await ethers.getContractFactory("B20ProviderConfigurator");
      const b20Configurator = await B20Configurator.deploy(await factory.getAddress());
      await equity.setAuthorizedConfigurator(await b20Configurator.getAddress(), true);
      await compliance.setAuthorizedConfigurator(await b20Configurator.getAddress(), true);
      const b20ProviderId = ethers.keccak256(ethers.toUtf8Bytes("OPENASSET_PROVIDER_B20"));
      await factory.connect(owner).setProviderConfigurator(
        b20ProviderId,
        await b20Configurator.getAddress()
      );
      await factory.connect(owner).setProviderAsset(b20ProviderId, await b20.getAddress(), true);
      const liquidationAdapter = (this as any).liquidationAdapter;
      const positionAdapter = (this as any).positionAdapter;

      for (const [address, type] of [
        [await b20Asset.getAddress(), 0],
        [await equity.getAddress(), 1],
        [await compliance.getAddress(), 2],
      ] as [string, number][]) {
        await registry.connect(governance).registerAdapter(address, type);
        await registry.connect(governance).markVerified(address, "B20 audit");
      }

      const config = {
        lpAddress: lp.address,
        collateralAsset: await b20.getAddress(),
        assetAdapter: await b20Asset.getAddress(),
        oracleAdapter: await equity.getAddress(),
        complianceAdapter: await compliance.getAddress(),
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
      const b20Config = { feed: await feed.getAddress(), maxStaleness: 90000, l2Sequencer: ethers.ZeroAddress };
      await lendingToken.connect(lp).approve(await factory.getAddress(), DEPOSIT_AMOUNT * 2n);

      const badConfig = { ...b20Config, l2Sequencer: owner.address };
      await expect(factory.connect(lp).createMarket(config, DEPOSIT_AMOUNT))
        .to.be.revertedWithCustomError(factory, "AssetReservedForProvider");
      await expect(factory.connect(lp).createB20Market(config, DEPOSIT_AMOUNT, badConfig))
        .to.be.revertedWith("B20 sequencer has no code");
      expect(await factory.getMarketCount()).to.equal(0);

      await factory.connect(lp).createB20Market(config, DEPOSIT_AMOUNT, b20Config);
      expect(await factory.getMarketCount()).to.equal(1);
      const marketAddress = (await factory.getAllMarkets())[0];
      const assetBinding = await b20Asset.marketConfigs(marketAddress);
      const complianceBinding = await compliance.marketConfigs(marketAddress);
      const feedBinding = await equity.marketConfigs(marketAddress);
      expect(assetBinding).to.equal(await b20.getAddress());
      expect(complianceBinding).to.equal(await b20.getAddress());
      expect(feedBinding[0]).to.equal(await feed.getAddress());
      expect(feedBinding[1]).to.equal(90000);
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
        factory.connect(lp).createMarket(config, DEPOSIT_AMOUNT)
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
        factory.connect(lp).createMarket(config, DEPOSIT_AMOUNT)
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
        factory.connect(lp).createMarket(config, DEPOSIT_AMOUNT)
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
