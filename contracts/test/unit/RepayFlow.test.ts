import { expect } from "chai";
import { ethers } from "hardhat";

// LendingMarketV2.LoanStatus: ACTIVE=0, GRACE_PERIOD=1, LIQUIDATION_CURE=2, SETTLING=3, REPAID=4, LIQUIDATED=5
const STATUS = { ACTIVE: 0n, REPAID: 4n } as const;

describe("RepayFlow (LendingMarketV2)", function () {
  let owner: any;
  let lp: any;
  let borrower: any;
  let thirdParty: any;
  let treasury: any;

  let collateral: any;
  let lending: any;
  let assetAdapter: any;
  let liquidationAdapter: any;
  let positionAdapter: any;
  let market: any;

  const APR_BPS = 1200n; // 12% annualized
  const DURATION = 30 * 24 * 60 * 60;
  const COLLATERAL_DEPOSIT = ethers.parseEther("100"); // 100 tokens @ $2000 = $200k value
  const DEPOSIT = ethers.parseEther("100000");
  const PRINCIPAL = ethers.parseEther("100000"); // 50% LTV
  const YEAR = 365n * 24n * 3600n;

  async function setup(liquidationAsync = false, cureWindow = 0) {
    [owner, lp, borrower, thirdParty, treasury] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    collateral = await MockERC20.deploy("Mock Token", "MTK", 18);
    lending = await MockERC20.deploy("USD Coin", "USDC", 18);

    const MockAssetAdapter = await ethers.getContractFactory("MockAssetAdapter");
    assetAdapter = await MockAssetAdapter.deploy(await collateral.getAddress());

    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    const oracleAdapter = await MockOracleAdapter.deploy(ethers.parseEther("2000"), true);

    const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
    liquidationAdapter = await MockLiquidationAdapter.deploy(liquidationAsync, cureWindow); // sync by default

    const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
    positionAdapter = await MockPositionAdapter.deploy();

    // LendingMarketV2 is a clone template: deploy template once, clone via MarketDeployer
    const MarketDeployer = await ethers.getContractFactory("MarketDeployer");
    const deployer = await MarketDeployer.deploy();

    
    await (await deployer.setFactory(admin.address)).wait(); // tests act as factoryconst params = {
      factory: ethers.ZeroAddress,
      marketOwner: owner.address,
      collateralAsset: await collateral.getAddress(),
      lendingAsset: await lending.getAddress(),
      protocolTreasury: treasury.address,
      assetAdapter: await assetAdapter.getAddress(),
      oracleAdapter: await oracleAdapter.getAddress(),
      complianceAdapter: ethers.ZeroAddress,
      liquidationAdapter: await liquidationAdapter.getAddress(),
      positionAdapter: await positionAdapter.getAddress(),
      ltvBps: 5000,
      aprBps: Number(APR_BPS),
      durationSeconds: DURATION,
      gracePeriodHours: 1,
      enableHealthFactor: true,
      healthFactorThreshold: 12000,
      cbConfig: { enabled: false, pauseThresholdBps: 2000, lookbackPeriodSeconds: 3600, resumeThresholdBps: 1000, cooldownSeconds: 7200 },
    };
    const marketAddress = await deployer.deploy.staticCall(params);
    await (await deployer.deploy(params)).wait();
    market = await ethers.getContractAt("LendingMarketV2", marketAddress);

    await collateral.mint(borrower.address, ethers.parseEther("100000"));
    await lending.mint(lp.address, ethers.parseEther("1000000"));
    await lending.mint(borrower.address, ethers.parseEther("100000"));
    await lending.mint(thirdParty.address, ethers.parseEther("200000"));

    await collateral.connect(borrower).approve(await assetAdapter.getAddress(), ethers.MaxUint256);
    await lending.connect(lp).approve(await market.getAddress(), ethers.MaxUint256);
    await lending.connect(borrower).approve(await market.getAddress(), ethers.MaxUint256);
    await lending.connect(thirdParty).approve(await market.getAddress(), ethers.MaxUint256);

    await market.connect(lp).depositLiquidity(DEPOSIT);
  }

  // Borrow max (50% LTV of $200k = $100k principal); returns the loanId
  async function borrow(): Promise<bigint> {
    await market.connect(borrower).requestLoan(COLLATERAL_DEPOSIT);
    return 0n; // nextLoanId starts at 0
  }

  it("full repay at t=0: debt = principal, collateral returns to borrower, position burned", async function () {
    await setup();
    const loanId = await borrow();

    const borrowerCollateralBefore = await collateral.balanceOf(borrower.address);
    const marketCollateralBefore = await collateral.balanceOf(await market.getAddress());

    const repayTx = await market.connect(borrower).repay(loanId);
    const receipt = await repayTx.wait();
    const repaidEvent = receipt.logs.find((l: any) => l.fragment?.name === "LoanRepaid");
    expect(repaidEvent).to.not.be.undefined;

    expect(await collateral.balanceOf(borrower.address)).to.equal(borrowerCollateralBefore + COLLATERAL_DEPOSIT);
    expect(await collateral.balanceOf(await market.getAddress())).to.equal(marketCollateralBefore - COLLATERAL_DEPOSIT);

    const loan = await market.loans(loanId);
    expect(loan.status).to.equal(STATUS.REPAID);

    const stats = await market.getMarketStats();
    expect(stats._totalBorrowed).to.equal(0n);
    // principal + lp revenue back in the pool; principal returned, LP interest share is the
    // accrued interest (tiny but > 0 after a few blocks) Ã— 90% LP share
    expect(stats._totalLiquidity).to.be.at.least(DEPOSIT);
    expect(stats._availableLiquidity).to.be.at.least(DEPOSIT);

    // position burned: mock returns zero address and bumps burnCount
    expect(await positionAdapter.ownerOf(loanId)).to.equal(ethers.ZeroAddress);
    expect(await positionAdapter.burnCount()).to.equal(1n);
  });

  it("full repay after 30 days: interest accrues, protocol share to treasury, LP revenue stays in pool", async function () {
    await setup();
    const loanId = await borrow();

    // Warp ~30 days â†’ interest = principal * 12% * 30/365
    await ethers.provider.send("evm_increaseTime", [30 * 24 * 3600]);
    await ethers.provider.send("evm_mine", []);

    const treasuryBefore = await lending.balanceOf(treasury.address);
    const statsBefore = await market.getMarketStats();

    await market.connect(borrower).repay(loanId);

    const statsAfter = await market.getMarketStats();
    const elapsed = 30n * 24n * 3600n;
    const expectedInterest = (PRINCIPAL * APR_BPS * elapsed) / (10000n * YEAR);
    const protocolShare = (expectedInterest * 1000n) / 10000n; // 10% protocol share
    const lpRevenue = expectedInterest - protocolShare;
    // Elapsed accrues a fraction of a second beyond the warp (warp granularity)
    const perSecondInterest = (PRINCIPAL * APR_BPS) / (10000n * YEAR);
    const tolerance = perSecondInterest * 10n;

    expect(statsAfter._totalBorrowed).to.equal(0n);
    expect(statsAfter._totalLiquidity).to.be.at.least(statsBefore._totalLiquidity + lpRevenue - tolerance);
    expect(statsAfter._totalLiquidity).to.be.at.most(statsBefore._totalLiquidity + lpRevenue + tolerance);
    expect((await lending.balanceOf(treasury.address)) - treasuryBefore).to.be.at.most(protocolShare + tolerance);
    expect((await lending.balanceOf(treasury.address)) - treasuryBefore).to.be.at.least(protocolShare - tolerance);
  });

  it("partial repay reduces principal, keeps collateral escrowed, then full repay releases it", async function () {
    await setup();
    const loanId = await borrow();

    // Warp 10 days so interest has accrued
    await ethers.provider.send("evm_increaseTime", [10 * 24 * 3600]);
    await ethers.provider.send("evm_mine", []);

    const interest10d = (PRINCIPAL * APR_BPS * 10n * 24n * 3600n) / (10000n * YEAR);
    const perSecondInterest = (PRINCIPAL * APR_BPS) / (10000n * YEAR);

    // Review C2 regression: paying LESS than the accrued interest must revert â€”
    // a dust payment used to reset startTime and permanently erase accrued interest.
    await expect(
      market.connect(borrower).repayPartial(loanId, interest10d - perSecondInterest * 60n)
    ).to.be.revertedWithCustomError(market, "RepayBelowAccruedInterest");

    // Pay the accrued interest (+ small headroom for block-timestamp drift) â†’
    // principal reduced by at most the headroom sliver; loan stays ACTIVE.
    await market.connect(borrower).repayPartial(loanId, interest10d + perSecondInterest * 10n);

    let loan = await market.loans(loanId);
    expect(loan.status).to.equal(STATUS.ACTIVE);
    expect(loan.principal).to.be.at.most(PRINCIPAL);
    expect(loan.principal).to.be.at.least(PRINCIPAL - perSecondInterest * 15n);

    // Collateral still escrowed (borrower had 100000, escrowed 100)
    expect(await collateral.balanceOf(borrower.address)).to.equal(ethers.parseEther("99900"));

    // Pay 40k of principal -> principal reduced (a sliver goes to freshly re-based interest)
    const principalBefore40k = loan.principal;
    await market.connect(borrower).repayPartial(loanId, ethers.parseEther("40000"));
    loan = await market.loans(loanId);
    expect(loan.principal).to.be.at.least(principalBefore40k - ethers.parseEther("40000"));
    expect(loan.principal).to.be.at.most(principalBefore40k - ethers.parseEther("40000") + perSecondInterest * 10n);

    const stats = await market.getMarketStats();
    expect(stats._totalBorrowed).to.equal(loan.principal);

    // Close the remainder with the canonical full repay (pays principal + accrued interest
    // at execution time; repayPartial == totalDebt is timestamp-exact by design and is
    // covered implicitly by the over-repay guard above)
    await market.connect(borrower).repay(loanId);

    loan = await market.loans(loanId);
    expect(loan.status).to.equal(STATUS.REPAID);
    // Collateral released to borrower on full repayment (minted 100000, all escrowed â†’ returned)
    expect(await collateral.balanceOf(borrower.address)).to.equal(ethers.parseEther("100000"));
    expect(await positionAdapter.ownerOf(loanId)).to.equal(ethers.ZeroAddress);
  });

  it("third party can repay on behalf of the borrower (funds pulled from repayer)", async function () {
    await setup();
    const loanId = await borrow();

    const borrowerLendingBefore = await lending.balanceOf(borrower.address);
    const thirdBefore = await lending.balanceOf(thirdParty.address);

    await market.connect(thirdParty).repay(loanId);

    expect(await lending.balanceOf(borrower.address)).to.equal(borrowerLendingBefore);
    // Repayer funds the full debt (principal + the ~1 block of accrued interest)
    const spent = thirdBefore - (await lending.balanceOf(thirdParty.address));
    expect(spent).to.be.at.most(PRINCIPAL + (PRINCIPAL * APR_BPS) / YEAR + 10n);
    expect(spent).to.be.at.least(PRINCIPAL);
    // Position holder (borrower) receives the collateral; repayer gets nothing
    expect(await collateral.balanceOf(borrower.address)).to.equal(ethers.parseEther("100000"));
    expect(await collateral.balanceOf(thirdParty.address)).to.equal(0n);
  });

  it("CURE: revenue-only partial repay re-freezes; final close-out does not re-charge frozen interest (C3 regression)", async function () {
    await setup(true, 0); // async adapter, 0s cure window — settle is permissionless after expiry anyway
    const loanId = await borrow();

    // Expire the loan, then enter LIQUIDATION_CURE via an async adapter
    await ethers.provider.send("evm_increaseTime", [31 * 24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await market.connect(borrower).liquidate(loanId);
    let loan = await market.loans(loanId);
    expect(loan.status).to.equal(2n); // LIQUIDATION_CURE
    expect(loan.frozenInterestAt).to.not.equal(0n);

    // Frozen debt: principal + frozen interest + 5% penalty
    const frozenInterest = loan.frozenInterestAt - loan.startTime;
    const frozenRevenue = (PRINCIPAL * APR_BPS * frozenInterest) / (10000n * YEAR);
    const penalty1 = (PRINCIPAL * 500n) / 10000n;

    // Pay ONLY the accrued revenue (interest + penalty) — no principal reduction
    await market.connect(borrower).repayPartial(loanId, frozenRevenue + penalty1 + (PRINCIPAL * APR_BPS * 10n) / YEAR);

    loan = await market.loans(loanId);
    expect(loan.status).to.equal(2n); // still in CURE
    // Re-freeze means the elapsed window restarted: frozen window is now ~0
    expect(loan.frozenInterestAt - loan.startTime).to.be.at.most(3n);

    // Final close-out charges only the remaining principal + fresh 5% penalty
    // (+ a tiny fresh-interest sliver). Under the old code it would re-charge the
    // already-paid frozen interest + penalty (≈ 2× revenue on the paid-down portion).
    const thirdBefore = await lending.balanceOf(thirdParty.address);
    await lending.connect(thirdParty).approve(await market.getAddress(), ethers.MaxUint256);
    await market.connect(thirdParty).repay(loanId);
    const spent = thirdBefore - (await lending.balanceOf(thirdParty.address));

    const freshPenalty = (loan.principal * 500n) / 10000n;
    // spent must be ≈ principal + fresh penalty (+ sliver) — NOT + old frozen revenue again
    expect(spent).to.be.at.least(loan.principal + freshPenalty);
    expect(spent).to.be.at.most(loan.principal + freshPenalty + (PRINCIPAL * APR_BPS) / YEAR);
  });

  it("sad paths: no allowance, zero amount, over-repay, already-repaid", async function () {
    await setup();
    const loanId = await borrow();

    // No allowance â†’ transferFrom reverts
    const spender = (await ethers.getSigners())[5];
    await lending.mint(spender.address, ethers.parseEther("200000"));
    await expect(market.connect(spender).repay(loanId)).to.be.reverted;

    // Zero amount
    await expect(market.connect(borrower).repayPartial(loanId, 0n)).to.be.revertedWithCustomError(
      market,
      "InvalidAmount"
    );

    // Over-repay partial (principal + generous interest headroom + 1)
    const [ , principal ] = await market.loans(loanId);
    const generousDebt = principal + (principal * APR_BPS) / YEAR;
    await expect(
      market.connect(borrower).repayPartial(loanId, generousDebt + ethers.parseEther("1"))
    ).to.be.revertedWithCustomError(market, "ExceedsTotalDebt");

    // Full repay then double repay reverts
    await market.connect(borrower).repay(loanId);
    await expect(market.connect(borrower).repay(loanId)).to.be.revertedWithCustomError(
      market,
      "LoanAlreadyRepaid"
    );
    await expect(
      market.connect(borrower).repayPartial(loanId, ethers.parseEther("1"))
    ).to.be.revertedWithCustomError(market, "LoanAlreadyRepaid");
  });
});



