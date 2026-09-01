import { expect } from "chai";
import { ethers } from "hardhat";

describe("Adapter testing environment", function () {
  it("simulates assets, a custom oracle, compliance, liquidation, and failures", async function () {
    const [factory, market, borrower] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock Collateral", "MC", 18);
    await token.waitForDeployment();
    await token.mint(borrower.address, ethers.parseEther("100"));

    const Feed = await ethers.getContractFactory("MockChainlinkFeed");
    const feed = await Feed.deploy(2000n * 10n ** 8n, 8, 0);
    await feed.waitForDeployment();

    const Oracle = await ethers.getContractFactory("ExampleOracleAdapter");
    const oracle = await Oracle.deploy(factory.address);
    await oracle.waitForDeployment();
    await oracle.connect(factory).configure(market.address, await token.getAddress());
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await oracle.connect(factory).setQuote(market.address, ethers.parseEther("2000"), now, true);
    expect((await oracle.connect(market).getPrice())[1]).to.equal(true);

    const Compliance = await ethers.getContractFactory("MockComplianceAdapter");
    const compliance = await Compliance.deploy(false);
    await compliance.waitForDeployment();
    await compliance.setAddressEligible(borrower.address, true);
    expect(await compliance.isEligible(borrower.address)).to.equal(true);
    await compliance.setRevert(true, "registry unavailable");
    await expect(compliance.isEligible(borrower.address)).to.be.revertedWith("registry unavailable");

    const Liquidation = await ethers.getContractFactory("MockLiquidationAdapter");
    const liquidation = await Liquidation.deploy(false, 0);
    await liquidation.waitForDeployment();
    await liquidation.setMockReturns(90, 10);
    const Market = await ethers.getContractFactory("MockLiquidationMarket");
    const mockMarket = await Market.deploy(await token.getAddress(), await token.getAddress(), borrower.address);
    await mockMarket.waitForDeployment();
    const result = await mockMarket.invokeLiquidation.staticCall(await liquidation.getAddress(), 7, 90);
    expect(result[0] + result[1]).to.equal(100);
    await liquidation.setRevert(true, "liquidation route unavailable");
    await expect(mockMarket.invokeLiquidation(await liquidation.getAddress(), 7, 90)).to.be.revertedWith("liquidation route unavailable");

    await expect(oracle.connect(borrower).configure(borrower.address, await token.getAddress())).to.be.revertedWith("Only factory");
    await expect(oracle.connect(borrower).getPrice()).to.be.revertedWith("Unconfigured market");
    expect(await feed.latestRoundData()).to.not.equal(undefined);
  });

  it("provides a gas measurement for a representative adapter operation", async function () {
    const [factory, market] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("ExampleOracleAdapter");
    const oracle = await Oracle.deploy(factory.address);
    await oracle.waitForDeployment();
    await oracle.connect(factory).configure(market.address, ethers.Wallet.createRandom().address);
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const tx = await oracle.connect(factory).setQuote(market.address, 1, now, true);
    const receipt = await tx.wait();
    expect(receipt!.gasUsed).to.be.lessThan(150000n);
  });
});
