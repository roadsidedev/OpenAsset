import { expect } from "chai";
import { ethers } from "hardhat";

describe("ExampleOracleAdapter", function () {
  async function deployFixture() {
    const [factory, marketA, marketB, outsider] = await ethers.getSigners();
    const Adapter = await ethers.getContractFactory("ExampleOracleAdapter");
    const adapter = await Adapter.deploy(factory.address);
    await adapter.waitForDeployment();
    return { adapter, factory, marketA, marketB, outsider };
  }

  it("configures per market and returns the configured quote", async function () {
    const { adapter, factory, marketA } = await deployFixture();
    await adapter.connect(factory).configure(marketA.address, ethers.Wallet.createRandom().address);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await adapter.connect(factory).setQuote(marketA.address, ethers.parseEther("2000"), now, true);

    const [price, trusted, updatedAt] = await adapter.connect(marketA).getPrice();
    expect(price).to.equal(ethers.parseEther("2000"));
    expect(trusted).to.equal(true);
    expect(updatedAt).to.equal(now);
  });

  it("isolates two market configurations on one adapter instance", async function () {
    const { adapter, factory, marketA, marketB } = await deployFixture();
    const assetA = ethers.Wallet.createRandom().address;
    const assetB = ethers.Wallet.createRandom().address;
    await adapter.connect(factory).configure(marketA.address, assetA);
    await adapter.connect(factory).configure(marketB.address, assetB);
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await adapter.connect(factory).setQuote(marketA.address, ethers.parseEther("2"), now, true);
    await adapter.connect(factory).setQuote(marketB.address, ethers.parseEther("7"), now, false);

    expect((await adapter.connect(marketA).getPrice())[0]).to.equal(ethers.parseEther("2"));
    expect((await adapter.connect(marketB).getPrice())[0]).to.equal(ethers.parseEther("7"));
    expect((await adapter.connect(marketB).getPrice())[1]).to.equal(false);
  });

  it("rejects unauthorized configuration and unconfigured runtime calls", async function () {
    const { adapter, factory, marketA, outsider } = await deployFixture();
    await expect(adapter.connect(outsider).configure(marketA.address, outsider.address)).to.be.revertedWith("Only factory");
    await expect(adapter.connect(marketA).getPrice()).to.be.revertedWith("Unconfigured market");
    await expect(adapter.connect(factory).setQuote(marketA.address, 1, 1, true)).to.be.revertedWith("Unconfigured market");
  });

  it("fails closed until a positive trusted quote is explicitly configured", async function () {
    const { adapter, factory, marketA } = await deployFixture();
    await adapter.connect(factory).configure(marketA.address, ethers.Wallet.createRandom().address);
    let [price, trusted] = await adapter.connect(marketA).getPrice();
    expect(price).to.equal(0);
    expect(trusted).to.equal(false);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await adapter.connect(factory).setQuote(marketA.address, 1, now, false);
    [price, trusted] = await adapter.connect(marketA).getPrice();
    expect(price).to.equal(1);
    expect(trusted).to.equal(false);
    expect(await adapter.connect(marketA).getHistoricalPrice(3600)).to.equal(0);
  });
});
