import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress } from "ethers";

/**
 * Review C4 regression: end-to-end ERC721 collateral through the REAL ERC721Adapter.
 * Previously: (a) safeTransferFrom escrow reverted (no onERC721Received),
 * (b) the escrow invariant compared NFT-count delta to the tokenId,
 * (c) valuation multiplied the tokenId as a quantity.
 */
describe("ERC721CollateralLifecycle (C4 regression)", function () {
  let admin: any;
  let borrower: any;
  let treasury: any;

  let collateral: any; // MockERC721
  let lending: any;
  let assetAdapter: any; // REAL ERC721Adapter
  let positionAdapter: any;
  let market: any;

  const PRICE = ethers.parseEther("2000"); // floor price 2000 USDC
  const LTV_BPS = 5000n;
  const EXPECTED_MAX_LOAN = ethers.parseEther("1000"); // 2000 * 50%
  const TOKEN_ID = 7777n; // deliberately large — old invariant only allowed tokenId <= 1

  async function setup() {
    [admin, borrower, , treasury] = await ethers.getSigners();

    const Nft = await ethers.getContractFactory("MockERC721");
    collateral = await Nft.deploy();
    const Token = await ethers.getContractFactory("MockERC20");
    lending = await Token.deploy("USD Coin", "USDC", 18);

    // REAL ERC721Adapter (factory = test runner, which wires the market below)
    const ERC721Adapter = await ethers.getContractFactory("ERC721Adapter");
    assetAdapter = await ERC721Adapter.deploy(admin.address);

    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    const oracleAdapter = await MockOracleAdapter.deploy(PRICE, true);
    const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
    const liquidationAdapter = await MockLiquidationAdapter.deploy(false, 0); // sync
    const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
    positionAdapter = await MockPositionAdapter.deploy();

    const MarketDeployer = await ethers.getContractFactory("MarketDeployer");
    const deployer = await MarketDeployer.deploy();

    
    await (await deployer.setFactory(admin.address)).wait(); // tests act as factoryconst params = {
      factory: ZeroAddress,
      marketOwner: admin.address,
      collateralAsset: await collateral.getAddress(),
      lendingAsset: await lending.getAddress(),
      protocolTreasury: treasury.address,
      assetAdapter: await assetAdapter.getAddress(),
      oracleAdapter: await oracleAdapter.getAddress(),
      complianceAdapter: ZeroAddress,
      liquidationAdapter: await liquidationAdapter.getAddress(),
      positionAdapter: await positionAdapter.getAddress(),
      ltvBps: Number(LTV_BPS),
      aprBps: 1200,
      durationSeconds: 30 * 24 * 3600,
      gracePeriodHours: 1,
      enableHealthFactor: true,
      healthFactorThreshold: 12000,
      cbConfig: { enabled: false, pauseThresholdBps: 2000, lookbackPeriodSeconds: 3600, resumeThresholdBps: 1000, cooldownSeconds: 7200 },
    };
    const marketAddress = await deployer.deploy.staticCall(params);
    await (await deployer.deploy(params)).wait();
    market = await ethers.getContractAt("LendingMarketV2", marketAddress);

    // Wire the real ERC721Adapter to this market (factory does this in production)
    await assetAdapter.configure(await market.getAddress(), await collateral.getAddress());

    // Fund: LP liquidity + borrower NFT + lending for repay
    const lp = (await ethers.getSigners())[4];
    await lending.mint(lp.address, ethers.parseEther("500000"));
    await lending.connect(lp).approve(await market.getAddress(), ethers.MaxUint256);
    await market.connect(lp).depositLiquidity(ethers.parseEther("200000"));
    await collateral.mint(borrower.address, TOKEN_ID);
    await collateral.mint(borrower.address, 7n);
    await lending.mint(borrower.address, ethers.parseEther("5000"));
    // Borrower approves the ADAPTER (the escrow spender), not the market
    await collateral.connect(borrower).setApprovalForAll(await assetAdapter.getAddress(), true);
    await lending.connect(borrower).approve(await market.getAddress(), ethers.MaxUint256);
    return { lp };
  }

  it("borrows against a high-tokenId NFT, values it at floor price, and repays to reclaim it", async function () {
    await setup();

    // Standard detection worked
    expect(await market.collateralIsERC20()).to.be.false;
    // Market granted setApprovalForAll to the asset adapter (release path)
    expect(await collateral.isApprovedForAll(await market.getAddress(), await assetAdapter.getAddress())).to.be.true;

    // Origination: collateralAmount = tokenId; valuation = floor price (NOT tokenId × price)
    await market.connect(borrower)["requestLoan(uint256)"](TOKEN_ID);
    const loan = await market.loans(0);
    expect(loan.principal).to.equal(EXPECTED_MAX_LOAN);
    expect(await collateral.ownerOf(TOKEN_ID)).to.equal(await market.getAddress());

    // Loan-sized valuation: health factor (bps scale) = floorPrice/debt = 2.0 → 20000
    const hf = await market.getHealthFactor(0);
    expect(hf).to.equal(20000n);

    // Partial repay then full repay → NFT returns to the borrower
    await market.connect(borrower).repayPartial(0, ethers.parseEther("200"));
    expect(await collateral.ownerOf(TOKEN_ID)).to.equal(await market.getAddress()); // still escrowed

    await market.connect(borrower).repay(0);
    expect(await collateral.ownerOf(TOKEN_ID)).to.equal(borrower.address);
    expect(await positionAdapter.ownerOf(0)).to.equal(ZeroAddress);
  });

  it("rejects escrow when the borrower has not approved the adapter (fail-closed)", async function () {
    await setup();
    const stranger = (await ethers.getSigners())[5];
    await collateral.mint(stranger.address, 9n);
    // no approval for the adapter
    await expect(market.connect(stranger)["requestLoan(uint256)"](9n)).to.be.revertedWithCustomError(
      market,
      "InvalidAmount"
    );
    // NFT stays with the owner
    expect(await collateral.ownerOf(9n)).to.equal(stranger.address);
  });

  it("second loan on the same collection with a different tokenId is independent", async function () {
    await setup();
    await market.connect(borrower)["requestLoan(uint256)"](TOKEN_ID);
    await market.connect(borrower)["requestLoan(uint256)"](7n);
    const [l0, l1] = await Promise.all([market.loans(0), market.loans(1)]);
    // Both loans valued at floor price → identical principal regardless of token id
    expect(l0.principal).to.equal(EXPECTED_MAX_LOAN);
    expect(l1.principal).to.equal(EXPECTED_MAX_LOAN);
    expect(await collateral.ownerOf(TOKEN_ID)).to.equal(await market.getAddress());
    expect(await collateral.ownerOf(7n)).to.equal(await market.getAddress());
  });
});
