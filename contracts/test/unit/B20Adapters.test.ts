import { ethers } from "hardhat";
import { expect } from "chai";

describe("B20 Adapters", function () {
  let factory: any, market: any, borrower: any, other: any;
  let b20: any, registry: any, assetAdapter: any, complianceAdapter: any;

  const PID_SENDER = 101n;
  const PID_RECEIVER = 202n;
  const PID_EXECUTOR = 303n;

  beforeEach(async function () {
    [factory, market, borrower, other] = await ethers.getSigners();

    const MockB20 = await ethers.getContractFactory("MockB20");
    b20 = await MockB20.deploy("Mock B20 AAPL", "AAPLc");
    const MockRegistry = await ethers.getContractFactory("MockPolicyRegistry");
    registry = await MockRegistry.deploy();

    const B20Asset = await ethers.getContractFactory("B20AssetAdapter");
    assetAdapter = await B20Asset.deploy(await factory.getAddress(), await registry.getAddress());

    const B20Compliance = await ethers.getContractFactory("B20PolicyComplianceAdapter");
    complianceAdapter = await B20Compliance.deploy(await factory.getAddress(), await registry.getAddress());

    await assetAdapter.connect(factory).configure(await market.getAddress(), await b20.getAddress());
    await complianceAdapter.connect(factory).configure(await market.getAddress());
    await complianceAdapter.connect(factory).registerToken(await market.getAddress(), await b20.getAddress());

    await b20.setPolicyId(await b20.TRANSFER_SENDER_POLICY(), PID_SENDER);
    await b20.setPolicyId(await b20.TRANSFER_RECEIVER_POLICY(), PID_RECEIVER);
    await b20.setPolicyId(await b20.TRANSFER_EXECUTOR_POLICY(), PID_EXECUTOR);

    await registry.setAuthorized(PID_SENDER, await borrower.getAddress(), true);
    await registry.setAuthorized(PID_RECEIVER, await borrower.getAddress(), true);
    await registry.setAuthorized(PID_RECEIVER, await market.getAddress(), true);
    await registry.setAuthorized(PID_EXECUTOR, await assetAdapter.getAddress(), true);

    await b20.mint(await borrower.getAddress(), ethers.parseEther("1000"));
    await b20.connect(borrower).approve(await assetAdapter.getAddress(), ethers.parseEther("1000"));
  });

  async function asMarket() {
    const marketAddr = await market.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount", [marketAddr]);
    const marketSigner = await ethers.getSigner(marketAddr);
    await factory.sendTransaction({ to: marketAddr, value: ethers.parseEther("1") });
    return { marketAddr, marketSigner };
  }

  async function stopMarket(marketAddr: string) {
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [marketAddr]);
  }

  it("uses the official uint64 policy registry selector", async function () {
    expect(ethers.id("isAuthorized(uint64,address)").slice(0, 10)).to.equal("0x55a1179e");
    expect(ethers.id("isAuthorized(bytes32,address)").slice(0, 10)).not.to.equal("0x55a1179e");
  });

  it("isTransferable true when all policies allow and balance/allowance are sufficient", async function () {
    const { marketAddr, marketSigner } = await asMarket();
    const ok = await assetAdapter.connect(marketSigner).isTransferable(
      await borrower.getAddress(),
      marketAddr,
      ethers.parseEther("100"),
    );
    expect(ok).to.equal(true);
    await stopMarket(marketAddr);
  });

  it("isTransferable false when sender policy blocks", async function () {
    await registry.setAuthorized(PID_SENDER, await borrower.getAddress(), false);
    const { marketAddr, marketSigner } = await asMarket();
    const ok = await assetAdapter.connect(marketSigner).isTransferable(
      await borrower.getAddress(),
      marketAddr,
      ethers.parseEther("10"),
    );
    expect(ok).to.equal(false);
    await stopMarket(marketAddr);
  });

  it("isTransferable false when executor policy blocks the asset adapter", async function () {
    await registry.setAuthorized(PID_EXECUTOR, await assetAdapter.getAddress(), false);
    const { marketAddr, marketSigner } = await asMarket();
    const ok = await assetAdapter.connect(marketSigner).isTransferable(
      await borrower.getAddress(),
      marketAddr,
      ethers.parseEther("10"),
    );
    expect(ok).to.equal(false);
    await stopMarket(marketAddr);
  });

  it("isTransferable fail-closed when token is not configured", async function () {
    const fakeMarket = other;
    const ok = await assetAdapter.connect(fakeMarket).isTransferable(
      await borrower.getAddress(),
      await fakeMarket.getAddress(),
      1,
    );
    expect(ok).to.equal(false);
  });

  it("compliance isEligible true when sender and receiver policies allow", async function () {
    const { marketAddr, marketSigner } = await asMarket();
    const eligible = await complianceAdapter.connect(marketSigner).isEligible(await borrower.getAddress());
    expect(eligible).to.equal(true);
    await stopMarket(marketAddr);
  });

  it("compliance fail-closed when a policy blocks", async function () {
    await registry.setAuthorized(PID_RECEIVER, await borrower.getAddress(), false);
    const { marketAddr, marketSigner } = await asMarket();
    const eligible = await complianceAdapter.connect(marketSigner).isEligible(await borrower.getAddress());
    expect(eligible).to.equal(false);
    await stopMarket(marketAddr);
  });

  it("rejects escrow while the B20 transfer feature is paused", async function () {
    const { marketAddr, marketSigner } = await asMarket();
    await b20.setPaused(true);
    await expect(
      assetAdapter.connect(marketSigner).escrow(await borrower.getAddress(), ethers.parseEther("10")),
    ).to.be.revertedWith("B20 transfers paused");
    await stopMarket(marketAddr);
  });

  it("escrow pulls correctly when configured", async function () {
    const { marketAddr, marketSigner } = await asMarket();
    const before = await b20.balanceOf(marketAddr);
    await assetAdapter.connect(marketSigner).escrow(await borrower.getAddress(), ethers.parseEther("100"));
    const after = await b20.balanceOf(marketAddr);
    expect(after - before).to.equal(ethers.parseEther("100"));
    await stopMarket(marketAddr);
  });

  it("H6: release pre-checks sender/receiver/executor policies and emits CollateralReleased", async function () {
    const { marketAddr, marketSigner } = await asMarket();
    await assetAdapter.connect(marketSigner).escrow(await borrower.getAddress(), ethers.parseEther("100"));
    // In production the market approves the adapter at initialize; mirror that here
    await b20.connect(marketSigner).approve(await assetAdapter.getAddress(), ethers.MaxUint256);

    // Market is not sender-authorized yet → release reverts with a precise error
    await expect(
      assetAdapter.connect(marketSigner).release(await borrower.getAddress(), ethers.parseEther("10"))
    ).to.be.revertedWithCustomError(assetAdapter, "B20ReleaseUnauthorized");
    expect(await assetAdapter.connect(marketSigner).isReleaseable(await borrower.getAddress(), ethers.parseEther("10"))).to.be.false;

    // Authorize the market as sender → release to the allowlisted borrower succeeds
    await registry.setAuthorized(PID_SENDER, marketAddr, true);
    expect(await assetAdapter.connect(marketSigner).isReleaseable(await borrower.getAddress(), ethers.parseEther("10"))).to.be.true;
    const borrowerBefore = await b20.balanceOf(await borrower.getAddress());
    const relTx = await assetAdapter.connect(marketSigner).release(await borrower.getAddress(), ethers.parseEther("10"));
    expect((await b20.balanceOf(await borrower.getAddress())) - borrowerBefore).to.equal(ethers.parseEther("10"));
    expect((await relTx.wait())!.logs.some((l: any) => l.fragment?.name === "CollateralReleased")).to.be.true;

    // De-authorize the recipient → release reverts again (would otherwise strand the loan)
    await registry.setAuthorized(PID_RECEIVER, await borrower.getAddress(), false);
    await expect(
      assetAdapter.connect(marketSigner).release(await borrower.getAddress(), ethers.parseEther("10"))
    ).to.be.revertedWithCustomError(assetAdapter, "B20ReleaseUnauthorized");
    expect(await assetAdapter.connect(marketSigner).isReleaseable(await borrower.getAddress(), ethers.parseEther("10"))).to.be.false;
    await stopMarket(marketAddr);
  });
});
