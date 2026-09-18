import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress } from "ethers";

/**
 * Review M1 e2e: real LendingMarketV2 + real NFTAuctionLiquidationAdapter async
 * liquidation lifecycle, proving:
 *   1. liquidate → CURE → settleLiquidation (handoff) → buy → finalize → LIQUIDATED
 *   2. a bare lending-asset donation during SETTLING cannot force early finalization
 *      (the adapter must acknowledge settlement via claimSettlement)
 */
describe("NFTLiquidationLifecycle (M1 e2e)", function () {
  const PRICE = ethers.parseEther("2000");
  const TOKEN_ID = 7777n;
  const DEBT = ethers.parseEther("1000"); // 50% LTV of floor

  async function setup() {
    const [admin, borrower, buyer, lp, treasury] = await ethers.getSigners();

    const Nft = await ethers.getContractFactory("MockERC721");
    const nft = await Nft.deploy();
    const Token = await ethers.getContractFactory("MockERC20");
    const lending = await Token.deploy("USD Coin", "USDC", 18);

    // REAL ERC721 asset adapter (factory = admin wires it below)
    const ERC721Adapter = await ethers.getContractFactory("ERC721Adapter");
    const assetAdapter = await ERC721Adapter.deploy(admin.address);

    // REAL NFT auction liquidation adapter (operator = admin until keeper wired)
    const NFTAuction = await ethers.getContractFactory("NFTAuctionLiquidationAdapter");
    const liquidationAdapter = await NFTAuction.deploy(admin.address);
    await liquidationAdapter.setOperator(admin.address);

    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    const oracleAdapter = await MockOracleAdapter.deploy(PRICE, true);
    const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
    const positionAdapter = await MockPositionAdapter.deploy();

    const LendingMarketV2 = await ethers.getContractFactory("LendingMarketV2");
    const template = await LendingMarketV2.deploy();
    const MarketDeployer = await ethers.getContractFactory("MarketDeployer");
    const deployer = await MarketDeployer.deploy(await template.getAddress());

    const params = {
      factory: ZeroAddress,
      marketOwner: admin.address,
      collateralAsset: await nft.getAddress(),
      lendingAsset: await lending.getAddress(),
      protocolTreasury: treasury.address,
      assetAdapter: await assetAdapter.getAddress(),
      oracleAdapter: await oracleAdapter.getAddress(),
      complianceAdapter: ZeroAddress,
      liquidationAdapter: await liquidationAdapter.getAddress(),
      positionAdapter: await positionAdapter.getAddress(),
      ltvBps: 5000,
      aprBps: 1200,
      durationSeconds: 30 * 24 * 3600,
      gracePeriodHours: 1,
      enableHealthFactor: true,
      healthFactorThreshold: 12000,
      cbConfig: { enabled: false, pauseThresholdBps: 2000, lookbackPeriodSeconds: 3600, resumeThresholdBps: 1000, cooldownSeconds: 7200 },
    };
    const marketAddress = await deployer.deploy.staticCall(params);
    await (await deployer.deploy(params)).wait();
    const market = await ethers.getContractAt("LendingMarketV2", marketAddress);

    // Wire adapters (production callers: factory + operator)
    await assetAdapter.configure(await market.getAddress(), await nft.getAddress());
    await liquidationAdapter.configure(await market.getAddress(), await assetAdapter.getAddress());

    // Fund LP + borrower
    await lending.mint(lp.address, ethers.parseEther("500000"));
    await lending.connect(lp).approve(await market.getAddress(), ethers.MaxUint256);
    await market.connect(lp).depositLiquidity(ethers.parseEther("200000"));
    await nft.mint(borrower.address, TOKEN_ID);
    await nft.connect(borrower).setApprovalForAll(await assetAdapter.getAddress(), true);
    await lending.mint(buyer.address, ethers.parseEther("5000"));
    await lending.connect(buyer).approve(await liquidationAdapter.getAddress(), ethers.MaxUint256);

    // Borrow
    await market.connect(borrower)["requestLoan(uint256)"](TOKEN_ID);
    return { admin, borrower, buyer, lp, treasury, nft, lending, market, liquidationAdapter, assetAdapter };
  }

  it("drives liquidate → CURE → settle → buy → finalize with real proceeds accounting", async function () {
    const { buyer, nft, lending, market, liquidationAdapter } = await setup();

    // Expire the loan → liquidate → CURE (72h window)
    await ethers.provider.send("evm_increaseTime", [31 * 24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await market.liquidate(0);
    expect((await market.loans(0)).status).to.equal(2n); // LIQUIDATION_CURE

    // Settle after the cure window: collateral hands off to the auction adapter
    await ethers.provider.send("evm_increaseTime", [72 * 3600 + 1]);
    await ethers.provider.send("evm_mine", []);
    await market.settleLiquidation(0);
    expect((await market.loans(0)).status).to.equal(3n); // LIQUIDATION_SETTLING
    expect(await nft.ownerOf(TOKEN_ID)).to.equal(await liquidationAdapter.getAddress());
    expect(await market.reservedSettling()).to.equal(DEBT);

    // Dutch auction buy at start (~150% of debt): market gets debt, holder gets surplus
    await liquidationAdapter.connect(buyer).buy(await market.getAddress(), 0);
    expect(await nft.ownerOf(TOKEN_ID)).to.equal(buyer.address);

    // Finalize: adapter acknowledges (SOLD), market recognizes recovery, reserve released
    await market.finalizeRedemptionSettlement(0);
    const loan = await market.loans(0);
    expect(loan.status).to.equal(5n); // LIQUIDATED
    expect(await market.reservedSettling()).to.equal(0n);

    const stats = await market.getMarketStats();
    expect(stats._totalBorrowed).to.equal(0n);
  });

  it("rejects donation-forced early finalization (M1 fail-closed)", async function () {
    const { nft, lending, market, liquidationAdapter } = await setup();

    await ethers.provider.send("evm_increaseTime", [31 * 24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await market.liquidate(0);
    await ethers.provider.send("evm_increaseTime", [72 * 3600 + 1]);
    await ethers.provider.send("evm_mine", []);
    await market.settleLiquidation(0);

    // Attacker donates lending asset directly to the market — delta is nonzero,
    // but the adapter has no sale to acknowledge → finalize MUST revert.
    const attacker = (await ethers.getSigners())[5];
    await lending.mint(attacker.address, ethers.parseEther("5000"));
    await lending.connect(attacker).transfer(await market.getAddress(), ethers.parseEther("1000"));

    await expect(market.finalizeRedemptionSettlement(0)).to.be.revertedWithCustomError(
      market,
      "SettlementNotClaimed"
    );
    expect((await market.loans(0)).status).to.equal(3n); // still SETTLING
  });
});
