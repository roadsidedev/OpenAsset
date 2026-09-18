import { expect } from "chai";
import { ethers } from "hardhat";

const BPS = 10000n;

describe("NFTAuctionLiquidationAdapter", function () {
  async function deployFixture() {
    const [governance, operator, holder, buyer, nobody] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const lending = await Token.deploy("USD Coin", "USDC", 6);
    const Nft = await ethers.getContractFactory("MockERC721");
    const nft = await Nft.deploy();
    const Market = await ethers.getContractFactory("MockNFTLiquidationMarket");
    const market = await Market.deploy(await nft.getAddress(), await lending.getAddress());
    const Adapter = await ethers.getContractFactory("NFTAuctionLiquidationAdapter");
    const adapter = await Adapter.deploy(governance.address);

    // Factory configures the market
    await adapter.connect(governance).configure(await market.getAddress(), governance.address);
    // Set the keeper/operator (delegated to the test's "operator" signer)
    await adapter.connect(governance).setOperator(operator.address);

    // Loan 1: NFT tokenId 7 escrowed in the mock market
    await nft.mint(await market.getAddress(), 7);
    await market.addLoan(7, holder.address);

    return { governance, operator, holder, buyer, nobody, lending, nft, market, adapter };
  }

  it("runs the async lifecycle: settle lists the auction, buyer pays decayed price, NFT routes to buyer", async function () {
    const { operator, holder, buyer, lending, nft, market, adapter } = await deployFixture();

    const debtOwed = 500n * 10n ** 6n; // 500 USDC
    // settle: (0,0) + no lending-asset movement enforced by the mock
    await market.invokeSettle(await adapter.getAddress(), 1, debtOwed);

    const startPrice = (debtOwed * 15000n) / BPS; // 750 USDC default
    const floorPrice = (debtOwed * 8000n) / BPS; // 400 USDC default

    // Full price at auction start = startPrice
    expect(await adapter.currentPrice(await market.getAddress(), 1)).to.equal(startPrice);

    // Buyer is funded, approves adapter
    await lending.mint(buyer.address, 1000n * 10n ** 6n);
    await lending.connect(buyer).approve(await adapter.getAddress(), ethers.MaxUint256);

    // Advance halfway: linear decay start → floor
    await ethers.provider.send("evm_increaseTime", [12 * 3600]);
    await ethers.provider.send("evm_mine", []);
    // Expected price derived from the on-chain auction state (block timestamps drift by a few seconds)
    const auctionMid = await adapter.auction(await market.getAddress(), 1);
    const latest = await ethers.provider.getBlock("latest");
    const elapsed = Math.min(Number(latest!.timestamp) - Number(auctionMid.startTime), Number(auctionMid.endTime) - Number(auctionMid.startTime));
    const expectedMid = auctionMid.startPrice - ((auctionMid.startPrice - auctionMid.floorPrice) * BigInt(elapsed)) / 86400n;
    const midPrice = await adapter.currentPrice(await market.getAddress(), 1);
    expect(midPrice).to.equal(expectedMid);

    const marketBefore = await lending.balanceOf(await market.getAddress());
    const holderBefore = await lending.balanceOf(holder.address);

    await adapter.connect(buyer).buy(await market.getAddress(), 1);

    expect(await nft.ownerOf(7)).to.equal(buyer.address);
    // midPrice (575 USDC) > debtOwed (500 USDC): market receives exactly debtOwed,
    // surplus (~75 USDC minus a few seconds' decay) goes to the holder.
    const paidToMarket = midPrice < debtOwed ? midPrice : debtOwed;
    const marketAfter = await lending.balanceOf(await market.getAddress());
    expect(marketAfter - marketBefore).to.equal(paidToMarket);
    const holderAfter = await lending.balanceOf(holder.address);
    expect(holderAfter - holderBefore).to.be.at.most(midPrice - debtOwed);
    expect(holderAfter - holderBefore).to.be.at.least(midPrice - debtOwed - 100_000n); // decay drift
    const auction = await adapter.auction(await market.getAddress(), 1);
    expect(auction.status).to.equal(2n); // SOLD
  });

  it("pays surplus directly to the holder when the sale price exceeds debt", async function () {
    const { holder, buyer, lending, nft, market, adapter } = await deployFixture();

    const debtOwed = 500n * 10n ** 6n;
    await market.invokeSettle(await adapter.getAddress(), 1, debtOwed);

    await lending.mint(buyer.address, 1000n * 10n ** 6n);
    await lending.connect(buyer).approve(await adapter.getAddress(), ethers.MaxUint256);

    // Buy at auction start: price ≈ 750 USDC, surplus ≈ 250 USDC to holder
    const marketBefore = await lending.balanceOf(await market.getAddress());
    const holderBefore = await lending.balanceOf(holder.address);
    await adapter.connect(buyer).buy(await market.getAddress(), 1);

    expect(await nft.ownerOf(7)).to.equal(buyer.address);
    // price > debtOwed: market receives exactly debtOwed; holder surplus decays a few seconds' worth
    expect(await lending.balanceOf(await market.getAddress())).to.equal(marketBefore + debtOwed);
    const holderAfter = await lending.balanceOf(holder.address);
    expect(holderAfter - holderBefore).to.be.at.most(250n * 10n ** 6n);
    expect(holderAfter - holderBefore).to.be.at.least(250n * 10n ** 6n - 100_000n); // ≤ ~25s decay drift
  });

  function makeOrderComponents(
    adapterAddress: string,
    nftAddress: string,
    lendingAddress: string,
    marketAddress: string,
    holderAddress: string,
    tokenId: bigint,
    debtOwed: bigint,
    surplus: bigint
  ) {
    return {
      offerer: adapterAddress,
      zone: ethers.ZeroAddress,
      offer: [
        { itemType: 2n, token: nftAddress, identifierOrCriteria: tokenId, startAmount: 1n, endAmount: 1n },
      ],
      consideration: [
        { itemType: 1n, token: lendingAddress, identifierOrCriteria: 0n, startAmount: debtOwed, endAmount: debtOwed, recipient: marketAddress },
        { itemType: 1n, token: lendingAddress, identifierOrCriteria: 0n, startAmount: surplus, endAmount: surplus, recipient: holderAddress },
      ],
      orderType: 0n,
      startTime: 0n,
      endTime: ethers.MaxUint256,
      zoneHash: ethers.ZeroHash,
      salt: 1n,
      conduitKey: ethers.ZeroHash,
      totalOriginalConsiderationItems: 2n,
      counter: 0n,
    };
  }

  it("validates EIP-1271 for registered Seaport orders (hash derived on-chain) and invalidates after native sale", async function () {
    const { operator, buyer, lending, nft, market, adapter, holder } = await deployFixture();

    const debtOwed = 500n * 10n ** 6n;
    await market.invokeSettle(await adapter.getAddress(), 1, debtOwed);

    const components = makeOrderComponents(
      await adapter.getAddress(),
      await nft.getAddress(),
      await lending.getAddress(),
      await market.getAddress(),
      holder.address,
      7n,
      debtOwed,
      250n * 10n ** 6n
    );

    // H3: the hash is DERIVED on-chain from the verified components — the operator
    // can no longer pair safe components with the hash of an underpaying order.
    const tx = await adapter.connect(operator).registerOrder(await market.getAddress(), 1, components);
    const receipt = await tx.wait();
    const registered = receipt!.logs.map((l: any) => l.fragment?.name === "OrderRegistered" ? l : null).find(Boolean);
    const orderHash = registered!.args[2] as string;
    expect(orderHash).to.not.equal(ethers.ZeroHash);

    const magic = await adapter.isValidSignature(orderHash, "0x");
    expect(magic).to.equal("0x1626ba7e");

    // Native sale invalidates the Seaport order
    await lending.mint(buyer.address, 1000n * 10n ** 6n);
    await lending.connect(buyer).approve(await adapter.getAddress(), ethers.MaxUint256);
    await adapter.connect(buyer).buy(await market.getAddress(), 1);

    const invalid = await adapter.isValidSignature(orderHash, "0x");
    expect(invalid).to.equal("0xffffffff");
    expect(await nft.ownerOf(7)).to.equal(buyer.address);
  });

  it("H3 regression: registerOrder enforces proceeds routing on-chain", async function () {
    const { operator, lending, nft, market, adapter, holder, nobody } = await deployFixture();
    const debtOwed = 500n * 10n ** 6n;
    await market.invokeSettle(await adapter.getAddress(), 1, debtOwed);

    const base = makeOrderComponents(
      await adapter.getAddress(),
      await nft.getAddress(),
      await lending.getAddress(),
      await market.getAddress(),
      holder.address,
      7n,
      debtOwed,
      250n * 10n ** 6n
    );

    // underpays the market
    const underpay = structuredClone(base);
    underpay.consideration[0].startAmount = 100n * 10n ** 6n;
    underpay.consideration[0].endAmount = 100n * 10n ** 6n;
    await expect(
      adapter.connect(operator).registerOrder(await market.getAddress(), 1, underpay)
    ).to.be.revertedWithCustomError(adapter, "InvalidOrder");

    // surplus routed to a third party instead of the holder
    const stolen = structuredClone(base);
    stolen.consideration[1].recipient = nobody.address;
    await expect(
      adapter.connect(operator).registerOrder(await market.getAddress(), 1, stolen)
    ).to.be.revertedWithCustomError(adapter, "InvalidOrder");

    // wrong offer token
    const wrongToken = structuredClone(base);
    wrongToken.offer[0].token = await lending.getAddress();
    await expect(
      adapter.connect(operator).registerOrder(await market.getAddress(), 1, wrongToken)
    ).to.be.revertedWithCustomError(adapter, "InvalidOrder");

    // consideration not in the lending asset
    const wrongCurrency = structuredClone(base);
    wrongCurrency.consideration[0].token = await nft.getAddress();
    await expect(
      adapter.connect(operator).registerOrder(await market.getAddress(), 1, wrongCurrency)
    ).to.be.revertedWithCustomError(adapter, "InvalidOrder");
  });

  it("rejects unregistered orders and non-operator registration", async function () {
    const { holder, nobody, lending, nft, market, adapter } = await deployFixture();
    const debtOwed = 500n * 10n ** 6n;
    await market.invokeSettle(await adapter.getAddress(), 1, debtOwed);

    const orderHash = ethers.id("seaport-order-2");
    // non-operator cannot register
    await expect(
      adapter.connect(nobody).registerOrder(
        await market.getAddress(), 1,
        makeOrderComponents(await adapter.getAddress(), await nft.getAddress(), await lending.getAddress(), await market.getAddress(), holder.address, 7n, debtOwed, 0n)
      )
    ).to.be.revertedWithCustomError(adapter, "NotOperator");

    // unregistered hash → EIP-1271 fail value
    expect(await adapter.isValidSignature(orderHash, "0x")).to.equal("0xffffffff");
  });

  it("enforces auction params bounds and reverts on bad config", async function () {
    const { governance, market, adapter } = await deployFixture();
    await expect(
      adapter.connect(governance).setAuctionParams(await market.getAddress(), 9000, 8000, 24 * 3600)
    ).to.be.revertedWithCustomError(adapter, "InvalidAuctionParams");
    await expect(
      adapter.connect(governance).setAuctionParams(await market.getAddress(), 15000, 8000, 600)
    ).to.be.revertedWithCustomError(adapter, "InvalidAuctionParams");
    await expect(
      adapter.connect(governance).setSeaport(await market.getAddress(), ethers.ZeroAddress, ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid seaport");
  });

  it("protects the async isolation contract: liquidate moves no lending asset and returns (0,0)", async function () {
    const { market, adapter, lending, nft } = await deployFixture();
    const debtOwed = 500n * 10n ** 6n;
    const before = await lending.balanceOf(await market.getAddress());
    // invokeSettle reverts with AdapterAccountingMismatch if the adapter violated isolation
    await expect(market.invokeSettle(await adapter.getAddress(), 1, debtOwed)).to.not.be.reverted;
    expect(await lending.balanceOf(await market.getAddress())).to.equal(before);
    // NFT moved to the adapter via handoff, and is now approved for the adapter as operator
    expect(await nft.ownerOf(7)).to.equal(await adapter.getAddress());
    // double-settle is blocked: the NFT is no longer in escrow, so the handoff itself reverts
    await expect(market.invokeSettle(await adapter.getAddress(), 1, debtOwed)).to.be.reverted;
  });

  it("cancelRegisteredOrder (H4 regression): invokes the market's Seaport and binds hash to the loan", async function () {
    const { governance, operator, lending, nft, holder, market, adapter } = await deployFixture();

    const Seaport = await ethers.getContractFactory("MockSeaport");
    const seaport = await Seaport.deploy();
    await adapter.connect(governance).setSeaport(await market.getAddress(), await seaport.getAddress(), ethers.ZeroAddress);

    const debtOwed = 500n * 10n ** 6n;
    await market.invokeSettle(await adapter.getAddress(), 1, debtOwed);

    const components = makeOrderComponents(
      await adapter.getAddress(),
      await nft.getAddress(),
      await lending.getAddress(),
      await market.getAddress(),
      holder.address,
      7n,
      debtOwed,
      0n
    );

    // Register via the verified-components path; hash is derived on-chain
    const regTx = await adapter.connect(operator).registerOrder(await market.getAddress(), 1, components);
    const regReceipt = await regTx.wait();
    const registered = regReceipt!.logs.map((l: any) => l.fragment?.name === "OrderRegistered" ? l : null).find(Boolean);
    const orderHash = registered!.args[2] as string;

    // Wrong loan binding reverts
    await expect(
      adapter.connect(operator).cancelRegisteredOrder(await market.getAddress(), 999, orderHash, components)
    ).to.be.revertedWithCustomError(adapter, "InvalidOrder");

    // Correct binding: on-chain Seaport cancel is invoked (was permanently dead pre-fix)
    expect(await seaport.cancelCalls()).to.equal(0n);
    await adapter.connect(operator).cancelRegisteredOrder(await market.getAddress(), 1, orderHash, components);
    expect(await seaport.cancelCalls()).to.equal(1n);

    // Locally invalidated: EIP-1271 fails after cancel
    expect(await adapter.isValidSignature(orderHash, "0x")).to.equal("0xffffffff");
  });

  it("is configured as an async, handoff-taking adapter with a 72h cure window", async function () {
    const { adapter } = await deployFixture();
    expect(await adapter.isAsynchronous()).to.equal(true);
    expect(await adapter.requiresCollateralHandoff()).to.equal(true);
    expect(await adapter.cureWindowSeconds()).to.equal(72n * 3600n);
  });
});
