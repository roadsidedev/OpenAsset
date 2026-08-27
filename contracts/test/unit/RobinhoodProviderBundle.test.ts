import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Robinhood provider bundle", function () {
  let owner: HardhatEthersSigner;
  let lp: HardhatEthersSigner;
  let governance: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let factory: any;
  let registry: any;
  let token: any;
  let lendingToken: any;
  let feed: any;
  let sequencer: any;
  let oracle: any;
  let compliance: any;
  let assetAdapter: any;
  let liquidationAdapter: any;
  let positionAdapter: any;
  let configurator: any;

  const ROBINHOOD = ethers.keccak256(ethers.toUtf8Bytes("OPENASSET_PROVIDER_ROBINHOOD"));
  const INITIAL_LIQUIDITY = ethers.parseUnits("1000", 6);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  function providerData(feedAddress: string, maxStaleness = 86400, sequencer = ethers.ZeroAddress) {
    return abiCoder.encode(["address", "uint256", "address"], [feedAddress, maxStaleness, sequencer]);
  }

  function marketConfig() {
    return {
      lpAddress: lp.address,
      collateralAsset: token.target,
      assetAdapter: assetAdapter.target,
      oracleAdapter: oracle.target,
      complianceAdapter: compliance.target,
      liquidationAdapter: liquidationAdapter.target,
      positionAdapter: positionAdapter.target,
      lendingAsset: lendingToken.target,
      ltvBasisPoints: 6500,
      aprBasisPoints: 1000,
      durationSeconds: 30 * 24 * 60 * 60,
      gracePeriodHours: 1,
      enableHealthFactor: true,
      healthFactorThreshold: 12000,
      enableCircuitBreaker: true,
      pauseThresholdBps: 2000,
      lookbackPeriodSeconds: 3600,
      resumeThresholdBps: 1000,
      cooldownSeconds: 7200,
    };
  }

  beforeEach(async function () {
    [owner, lp, governance, treasury] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AdapterRegistry");
    registry = await Registry.deploy(governance.address);
    const Deployer = await ethers.getContractFactory("MarketDeployer");
    const deployer = await Deployer.deploy();
    const Factory = await ethers.getContractFactory("MarketFactoryV2");
    factory = await Factory.deploy(owner.address, treasury.address, registry.target, deployer.target);

    const MockToken = await ethers.getContractFactory("MockRobinhoodToken");
    token = await MockToken.deploy("Robinhood Apple Token", "AAPL");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    lendingToken = await MockERC20.deploy("USD Coin", "USDC", 6);
    await factory.addLendingAsset(lendingToken.target);

    const Feed = await ethers.getContractFactory("MockChainlinkFeed");
    feed = await Feed.deploy(200n * 10n ** 8n, 8, 1);
    sequencer = await Feed.deploy(0, 0, 1);
    const Asset = await ethers.getContractFactory("ERC20Adapter");
    assetAdapter = await Asset.deploy(factory.target);
    const Oracle = await ethers.getContractFactory("ChainlinkEquityFeedAdapter");
    oracle = await Oracle.deploy(factory.target);
    const Compliance = await ethers.getContractFactory("ManagedAllowlistComplianceAdapter");
    compliance = await Compliance.deploy(factory.target);
    const Liquidation = await ethers.getContractFactory("MockLiquidationAdapter");
    liquidationAdapter = await Liquidation.deploy(false, 0);
    const Position = await ethers.getContractFactory("MockPositionAdapter");
    positionAdapter = await Position.deploy();
    const Configurator = await ethers.getContractFactory("RobinhoodProviderConfigurator");
    configurator = await Configurator.deploy(factory.target);

    for (const [address, type] of [
      [assetAdapter.target, 0],
      [oracle.target, 1],
      [compliance.target, 2],
      [liquidationAdapter.target, 3],
      [positionAdapter.target, 4],
    ] as [string, number][]) {
      await registry.connect(governance).registerAdapter(address, type);
      await registry.connect(governance).markVerified(address, "Robinhood bundle audit");
    }

    await oracle.setAuthorizedConfigurator(configurator.target, true);
    await factory.setProviderConfigurator(ROBINHOOD, configurator.target);
    await factory.setProviderAsset(ROBINHOOD, token.target, true);
    await lendingToken.mint(lp.address, ethers.parseUnits("1000000", 6));
  });

  it("atomically configures a Robinhood market and records its provider identity", async function () {
    const config = marketConfig();
    await lendingToken.connect(lp).approve(factory.target, INITIAL_LIQUIDITY);

    await expect(
      factory.connect(lp).createProviderMarket(
        config,
        INITIAL_LIQUIDITY,
        { providerId: ROBINHOOD, providerData: providerData(feed.target, 86400, sequencer.target) }
      )
    ).to.emit(factory, "ProviderMarketInitialized");

    expect(await factory.getMarketCount()).to.equal(1);
    const market = (await factory.getAllMarkets())[0];
    expect(await factory.marketProvider(market)).to.equal(ROBINHOOD);
    expect(await compliance.configuredMarkets(market)).to.equal(true);

    const feedConfig = await oracle.marketConfigs(market);
    expect(feedConfig.feed).to.equal(feed.target);
    expect(feedConfig.feedDecimals).to.equal(8);
    expect(feedConfig.pauseToken).to.equal(token.target);
    expect(feedConfig.checkTokenOraclePause).to.equal(true);
  });

  it("escrows Robinhood collateral and originates a selected-principal loan end to end", async function () {
    const config = marketConfig();
    await lendingToken.connect(lp).approve(factory.target, INITIAL_LIQUIDITY);
    await factory.connect(lp).createProviderMarket(
      config,
      INITIAL_LIQUIDITY,
      { providerId: ROBINHOOD, providerData: providerData(feed.target, 86400, sequencer.target) }
    );

    const market = (await factory.getAllMarkets())[0];
    await compliance.setEligibility(market, owner.address, true);
    await token.mint(owner.address, ethers.parseEther("1"));
    await token.connect(owner).approve(assetAdapter.target, ethers.parseEther("1"));

    const Market = await ethers.getContractFactory("LendingMarketV2");
    const lendingMarket = Market.attach(market);
    await expect(
      lendingMarket.connect(owner)["requestLoan(uint256,uint256)"](ethers.parseEther("1"), ethers.parseUnits("100", 6))
    ).to.emit(lendingMarket, "LoanCreated");

    expect(await token.balanceOf(market)).to.equal(ethers.parseEther("1"));
    const loan = await lendingMarket.loans(0);
    expect(loan.collateralAmount).to.equal(ethers.parseEther("1"));
    expect(loan.principal).to.equal(ethers.parseUnits("100", 6));
  });

  it("fails closed while the Robinhood token oracle is paused", async function () {
    const config = marketConfig();
    config.enableCircuitBreaker = false;
    await lendingToken.connect(lp).approve(factory.target, INITIAL_LIQUIDITY);
    await factory.connect(lp).createProviderMarket(
      config,
      INITIAL_LIQUIDITY,
      { providerId: ROBINHOOD, providerData: providerData(feed.target, 86400, sequencer.target) }
    );

    const market = (await factory.getAllMarkets())[0];
    await compliance.setEligibility(market, owner.address, true);
    await token.mint(owner.address, ethers.parseEther("1"));
    await token.connect(owner).approve(assetAdapter.target, ethers.parseEther("1"));
    await token.setOraclePaused(true);

    const Market = await ethers.getContractFactory("LendingMarketV2");
    const lendingMarket = Market.attach(market);
    await expect(
      lendingMarket.connect(owner)["requestLoan(uint256,uint256)"](ethers.parseEther("1"), ethers.parseUnits("100", 6))
    ).to.be.revertedWithCustomError(lendingMarket, "OracleUntrusted");
  });

  it("rejects unapproved Robinhood collateral and non-owner asset reservations", async function () {
    const OtherToken = await ethers.getContractFactory("MockRobinhoodToken");
    const otherToken = await OtherToken.deploy("Unapproved Apple Token", "uAAPL");
    const config = marketConfig();
    config.collateralAsset = otherToken.target;
    await expect(factory.connect(lp).createProviderMarket(
      config,
      INITIAL_LIQUIDITY,
      { providerId: ROBINHOOD, providerData: providerData(feed.target, 86400, sequencer.target) },
    )).to.be.revertedWithCustomError(factory, "ProviderAssetNotApproved");
    await expect(factory.connect(lp).setProviderAsset(ROBINHOOD, otherToken.target, true))
      .to.be.revertedWithCustomError(factory, "Unauthorized");
  });

  it("reverts before publication when Robinhood feed configuration is invalid", async function () {
    const config = marketConfig();
    await lendingToken.connect(lp).approve(factory.target, INITIAL_LIQUIDITY);

    await expect(
      factory.connect(lp).createProviderMarket(
        config,
        INITIAL_LIQUIDITY,
        { providerId: ROBINHOOD, providerData: providerData(owner.address) }
      )
    ).to.be.revertedWith("Robinhood feed has no code");

    expect(await factory.getMarketCount()).to.equal(0);
  });
});
