import { expect } from "chai";
import { ethers } from "hardhat";

describe("DEXSwap per-market routing + factory Rule 6", function () {
  async function deployAdapterFixture() {
    const [owner, holder] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const collateral = await Token.deploy("B20 AAPL", "AAPLc", 8);
    const lending = await Token.deploy("USD Coin", "USDC", 6);
    const Router = await ethers.getContractFactory("MockUniswapV3Router");
    const routerA = await Router.deploy();
    const routerB = await Router.deploy();
    const Market = await ethers.getContractFactory("MockLiquidationMarket");
    const market = await Market.deploy(await collateral.getAddress(), await lending.getAddress(), holder.address);
    const Adapter = await ethers.getContractFactory("DEXSwapLiquidationAdapter");
    const adapter = await Adapter.deploy(owner.address);

    await adapter.configure(await market.getAddress(), owner.address);
    await adapter.configureRisk(await market.getAddress(), owner.address, 500);
    await adapter.addApprovedRouter(await routerA.getAddress());
    await adapter.setRouter(await routerA.getAddress());
    await routerA.setOutputMultiplier(7n * 10n ** 16n); // out = 700e6 per 100e8 collateral
    await routerB.setOutputMultiplier(9n * 10n ** 16n); // out = 900e6
    await lending.mint(await routerA.getAddress(), 1000n * 10n ** 6n);
    await lending.mint(await routerB.getAddress(), 1000n * 10n ** 6n);
    await market.setLoan(100n * 10n ** 8n, holder.address);
    await market.setQuote(700n * 10n ** 6n, true);
    await collateral.mint(await adapter.getAddress(), 100n * 10n ** 8n);

    return { owner, holder, collateral, lending, routerA, routerB, market, adapter };
  }

  it("uses the global router when no per-market override is set", async function () {
    const { holder, market, adapter, lending, routerA } = await deployAdapterFixture();
    const cfg = await adapter.getMarketLiquidationConfig(await market.getAddress());
    expect(cfg[0]).to.equal(await routerA.getAddress());
    expect(cfg[1]).to.equal(3000n); // DEFAULT_POOL_FEE
    expect(cfg[2]).to.equal(500n);
    expect(cfg[3]).to.equal(true);

    const holderBefore = await lending.balanceOf(holder.address);
    await market.invokeLiquidation(await adapter.getAddress(), 0, 500n * 10n ** 6n);
    // surplus 700e6 - 500e6 = 200e6 proves the global router (routerA) was used
    expect((await lending.balanceOf(holder.address)) - holderBefore).to.equal(200n * 10n ** 6n);
  });

  it("per-market router override takes precedence over the global router", async function () {
    const { holder, market, adapter, lending, routerA, routerB } = await deployAdapterFixture();
    // H2: router must be allowlisted before it can serve as an override
    await adapter.addApprovedRouter(await routerB.getAddress());
    await adapter.setMarketRouter(await market.getAddress(), await routerB.getAddress());

    const cfg = await adapter.getMarketLiquidationConfig(await market.getAddress());
    expect(cfg[0]).to.equal(await routerB.getAddress());
    expect(cfg[0]).to.not.equal(await routerA.getAddress());

    const holderBefore = await lending.balanceOf(holder.address);
    await market.invokeLiquidation(await adapter.getAddress(), 0, 500n * 10n ** 6n);
    // surplus 900e6 - 500e6 = 400e6 proves the per-market override (routerB) was used
    expect((await lending.balanceOf(holder.address)) - holderBefore).to.equal(400n * 10n ** 6n);
  });

  it("clearing the override falls back to the global router", async function () {
    const { holder, market, adapter, lending, routerA, routerB } = await deployAdapterFixture();
    await adapter.addApprovedRouter(await routerB.getAddress());
    await adapter.setMarketRouter(await market.getAddress(), await routerB.getAddress());
    await adapter.setMarketRouter(await market.getAddress(), ethers.ZeroAddress);
    const cfg = await adapter.getMarketLiquidationConfig(await market.getAddress());
    expect(cfg[0]).to.equal(await routerA.getAddress());

    const holderBefore = await lending.balanceOf(holder.address);
    await market.invokeLiquidation(await adapter.getAddress(), 0, 500n * 10n ** 6n);
    expect((await lending.balanceOf(holder.address)) - holderBefore).to.equal(200n * 10n ** 6n);
  });

  it("H2 regression: routers must be allowlisted before use", async function () {
    const { owner, market, adapter, routerB } = await deployAdapterFixture();
    // setRouter without allowlisting reverts
    await expect(adapter.setRouter(await routerB.getAddress())).to.be.revertedWith("Router not allowlisted");
    // per-market override of a non-allowlisted router reverts
    await expect(
      adapter.setMarketRouter(await market.getAddress(), await routerB.getAddress())
    ).to.be.revertedWith("Router not allowlisted");
    // an EOA can never be allowlisted (code check)
    const [ , , , , stranger] = await ethers.getSigners();
    await expect(adapter.connect(owner).addApprovedRouter(stranger.address)).to.be.revertedWith("Invalid router");
    // owner can revoke; a revoked router can no longer be set
    await adapter.addApprovedRouter(await routerB.getAddress());
    await adapter.removeApprovedRouter(await routerB.getAddress());
    await expect(adapter.setRouter(await routerB.getAddress())).to.be.revertedWith("Router not allowlisted");
  });

  it("rejects invalid router overrides and unconfigured markets", async function () {
    const { owner, market, adapter } = await deployAdapterFixture();
    const [ , , , , stranger] = await ethers.getSigners();
    await expect(
      adapter.connect(owner).setMarketRouter(await market.getAddress(), stranger.address)
    ).to.be.revertedWith("Router not allowlisted");
    await expect(
      adapter.connect(owner).setMarketRouter(stranger.address, stranger.address)
    ).to.be.revertedWith("Unconfigured market");
  });

  it("factory Rule 6: createMarket reverts when the DEX liquidation adapter has no router", async function () {
    const [admin, , lp] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const collateral = await Token.deploy("Mock Token", "MTK", 18);
    const lending = await Token.deploy("USD Coin", "USDC", 18);

    const AdapterRegistry = await ethers.getContractFactory("AdapterRegistry");
    const registry = await AdapterRegistry.deploy(admin.address);
    const MarketDeployer = await ethers.getContractFactory("MarketDeployer");
    const deployer = await MarketDeployer.deploy();
    const MarketFactoryV2 = await ethers.getContractFactory("MarketFactoryV2");
    const factory = await MarketFactoryV2.deploy(admin.address, admin.address, await registry.getAddress(), await deployer.getAddress());
    await (await deployer.setFactory(await factory.getAddress())).wait();
    await factory.addLendingAsset(await lending.getAddress());

    const ERC20Adapter = await ethers.getContractFactory("ERC20Adapter");
    const assetAdapter = await ERC20Adapter.deploy(await factory.getAddress());
    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    const oracleAdapter = await MockOracleAdapter.deploy(ethers.parseEther("2000"), true);
    const Adapter = await ethers.getContractFactory("DEXSwapLiquidationAdapter");
    // adapter's "factory" must be the actual MarketFactoryV2 (its onlyFactory gate)
    const liquidationAdapter = await Adapter.deploy(await factory.getAddress());
    const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
    const positionAdapter = await MockPositionAdapter.deploy();

    await registry.registerAdapter(await assetAdapter.getAddress(), 0);
    await registry.registerAdapter(await oracleAdapter.getAddress(), 1);
    await registry.registerAdapter(await liquidationAdapter.getAddress(), 3);
    await registry.registerAdapter(await positionAdapter.getAddress(), 4);

    const config = {
      lpAddress: lp.address,
      collateralAsset: await collateral.getAddress(),
      assetAdapter: await assetAdapter.getAddress(),
      oracleAdapter: await oracleAdapter.getAddress(),
      complianceAdapter: ethers.ZeroAddress,
      liquidationAdapter: await liquidationAdapter.getAddress(),
      positionAdapter: await positionAdapter.getAddress(),
      lendingAsset: await lending.getAddress(),
      ltvBasisPoints: 5000,
      aprBasisPoints: 1200,
      durationSeconds: 30 * 24 * 3600,
      gracePeriodHours: 24,
      enableHealthFactor: true,
      healthFactorThreshold: 12000,
      enableCircuitBreaker: false,
      pauseThresholdBps: 2000,
      lookbackPeriodSeconds: 3600,
      resumeThresholdBps: 1000,
      cooldownSeconds: 7200,
    };
    const initialLiquidity = ethers.parseEther("200000");
    await lending.mint(admin.address, initialLiquidity);
    await lending.connect(admin).approve(await factory.getAddress(), initialLiquidity);

    // No router configured → Rule 6 must reject the deployment
    await expect(factory.connect(admin).createMarket(config, initialLiquidity)).to.be.revertedWith(
      "Liquidation router unset"
    );

    // Once the global router is approved + set, creation succeeds
    const Router = await ethers.getContractFactory("MockUniswapV3Router");
    const router = await Router.deploy();
    await liquidationAdapter.connect(admin).addApprovedRouter(await router.getAddress());
    await liquidationAdapter.connect(admin).setRouter(await router.getAddress());
    const marketAddress = await factory.connect(admin).createMarket.staticCall(config, initialLiquidity);
    await (await factory.connect(admin).createMarket(config, initialLiquidity)).wait();

    // Per-market override set after creation is honored by the config view
    await liquidationAdapter.setMarketRouter(marketAddress, await router.getAddress());
    const [effectiveRouter] = await liquidationAdapter.getMarketLiquidationConfig(marketAddress);
    expect(effectiveRouter).to.equal(await router.getAddress());
  });
});
