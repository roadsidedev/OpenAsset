import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * Local end-to-end lifecycle: deploy the full production stack (AdapterRegistry →
 * MarketFactoryV2 → real ERC20Adapter/position/liquidation adapters → market clone),
 * then drive: deposit → borrow → accrue → partial repay → full repay → collateral
 * returned to the borrower's wallet.
 */
describe("RepayLifecycleE2E", function () {
  let admin: any;
  let lp: any;
  let borrower: any;
  let treasury: any;

  let registry: any;
  let factory: any;
  let collateral: any;
  let lending: any;
  let market: any;
  let assetAdapter: any;
  let positionAdapter: any;

  const APR_BPS = 1200n;
  const YEAR = 365n * 24n * 3600n;
  const PRINCIPAL = ethers.parseEther("50000"); // 50k of the 100k max loan

  async function setup() {
    [admin, lp, borrower, treasury] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    collateral = await MockERC20.deploy("Mock Token", "MTK", 18);
    lending = await MockERC20.deploy("USD Coin", "USDC", 18);

    const AdapterRegistry = await ethers.getContractFactory("AdapterRegistry");
    registry = await AdapterRegistry.deploy(admin.address);

    const LendingMarketV2 = await ethers.getContractFactory("LendingMarketV2");
    const template = await LendingMarketV2.deploy();
    const MarketDeployer = await ethers.getContractFactory("MarketDeployer");
    const deployer = await MarketDeployer.deploy(await template.getAddress());
    const MarketFactoryV2 = await ethers.getContractFactory("MarketFactoryV2");
    factory = await MarketFactoryV2.deploy(admin.address, admin.address, await registry.getAddress(), await deployer.getAddress());

    await factory.addLendingAsset(await lending.getAddress());

    const ERC20Adapter = await ethers.getContractFactory("ERC20Adapter");
    assetAdapter = await ERC20Adapter.deploy(await factory.getAddress());
    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    const oracleAdapter = await MockOracleAdapter.deploy(ethers.parseEther("2000"), true);
    const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
    const liquidationAdapter = await MockLiquidationAdapter.deploy(false, 0); // sync
    const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
    positionAdapter = await MockPositionAdapter.deploy();

    await registry.registerAdapter(await assetAdapter.getAddress(), 0); // ASSET
    await registry.registerAdapter(await oracleAdapter.getAddress(), 1); // ORACLE
    await registry.registerAdapter(await liquidationAdapter.getAddress(), 3); // LIQUIDATION
    await registry.registerAdapter(await positionAdapter.getAddress(), 4); // POSITION

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
      aprBasisPoints: Number(APR_BPS),
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
    // The factory pulls initial liquidity from the caller (admin)
    await lending.mint(admin.address, initialLiquidity);
    await lending.connect(admin).approve(await factory.getAddress(), initialLiquidity);
    const marketAddress = await factory.connect(admin).createMarket.staticCall(config, initialLiquidity);
    await (await factory.connect(admin).createMarket(config, initialLiquidity)).wait();
    market = await ethers.getContractAt("LendingMarketV2", marketAddress);

    await collateral.mint(borrower.address, ethers.parseEther("100000"));
    await lending.mint(borrower.address, ethers.parseEther("100000"));

    // Borrower must approve the ADAPTER (escrow executor), not the market.
    // (The market pre-approves the adapter for release in its initializer.)
    await collateral.connect(borrower).approve(await assetAdapter.getAddress(), ethers.MaxUint256);
    await lending.connect(borrower).approve(await market.getAddress(), ethers.MaxUint256);
    await lending.connect(lp).approve(await market.getAddress(), ethers.MaxUint256);
  }

  it("drives deposit → borrow → accrue → partial repay → full repay → collateral returned", async function () {
    await setup();

    // 1. Deposit (done in setup) — verify market stats (0.5% creation fee deducted by the factory)
    const initialLiquidity = ethers.parseEther("200000");
    const expectedNet = initialLiquidity - (initialLiquidity * 50n) / 10000n; // 0.5% CREATION_FEE_BPS
    const stats0 = await market.getMarketStats();
    expect(stats0._totalLiquidity).to.equal(expectedNet);

    // 2. Borrow (requestedPrincipal = 50k of the 100k max)
    await market.connect(borrower)["requestLoan(uint256,uint256)"](ethers.parseEther("100"), PRINCIPAL);
    const loanId = 0n;

    const loan = await market.loans(loanId);
    expect(loan.principal).to.equal(PRINCIPAL);
    expect(loan.status).to.equal(0n); // ACTIVE
    // Borrower received principal (100k minted + 50k borrowed); collateral escrowed
    expect(await lending.balanceOf(borrower.address)).to.equal(ethers.parseEther("150000"));
    expect(await collateral.balanceOf(await market.getAddress())).to.equal(ethers.parseEther("100"));

    // 3. Accrue 20 days
    await ethers.provider.send("evm_increaseTime", [20 * 24 * 3600]);
    await ethers.provider.send("evm_mine", []);

    // 4. Partial repay: pay 20k — accrued interest (~329 over 20d) is paid first,
    // remainder reduces principal. Loan still ACTIVE, collateral still escrowed.
    const borrowerCollateralBefore = await collateral.balanceOf(borrower.address);
    await market.connect(borrower).repayPartial(loanId, ethers.parseEther("20000"));
    const loanAfterPartial = await market.loans(loanId);
    const elapsed = 20n * 24n * 3600n;
    const interestAccrued = (PRINCIPAL * APR_BPS * elapsed) / (10000n * YEAR);
    const perSecondInterest = (PRINCIPAL * APR_BPS) / (10000n * YEAR);
    const expectedPrincipal = PRINCIPAL - (ethers.parseEther("20000") - interestAccrued);
    expect(loanAfterPartial.status).to.equal(0n);
    expect(loanAfterPartial.principal).to.be.at.least(expectedPrincipal - perSecondInterest * 10n);
    expect(loanAfterPartial.principal).to.be.at.most(expectedPrincipal + perSecondInterest * 10n);
    expect(await collateral.balanceOf(borrower.address)).to.equal(borrowerCollateralBefore);

    // 5. Full repay → collateral returns to the borrower
    const borrowerLendingBefore = await lending.balanceOf(borrower.address);
    await market.connect(borrower).repay(loanId);

    expect(await collateral.balanceOf(borrower.address)).to.equal(borrowerCollateralBefore + ethers.parseEther("100"));
    const finalLoan = await market.loans(loanId);
    expect(finalLoan.status).to.equal(4n); // REPAID
    expect(await positionAdapter.ownerOf(loanId)).to.equal(ethers.ZeroAddress);

    // Pool restored: liquidity back up (principal + LP share of interest), borrower spent debt
    const stats1 = await market.getMarketStats();
    expect(stats1._totalBorrowed).to.equal(0n);
    expect(stats1._availableLiquidity).to.be.at.least(expectedNet);
    expect((await lending.balanceOf(borrower.address)) < borrowerLendingBefore).to.be.true;

    // 6. Double repay reverts
    await expect(market.connect(borrower).repay(loanId)).to.be.revertedWithCustomError(market, "LoanAlreadyRepaid");
  });
});
