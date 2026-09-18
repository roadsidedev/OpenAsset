import { expect } from "chai";
import { ethers } from "hardhat";

describe("DEXSwapLiquidationAdapter", function () {
  it("hands off collateral, enforces the quoted minimum, repays debt, and returns surplus", async function () {
    const [owner, holder] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const collateral = await Token.deploy("B20 AAPL", "AAPLc", 8);
    const lending = await Token.deploy("USD Coin", "USDC", 6);
    const Router = await ethers.getContractFactory("MockUniswapV3Router");
    const router = await Router.deploy();
    const Market = await ethers.getContractFactory("MockLiquidationMarket");
    const market = await Market.deploy(await collateral.getAddress(), await lending.getAddress(), holder.address);
    const Adapter = await ethers.getContractFactory("DEXSwapLiquidationAdapter");
    const adapter = await Adapter.deploy(owner.address);

    await adapter.connect(owner).addApprovedRouter(await router.getAddress());
    await adapter.connect(owner).setRouter(await router.getAddress());
    await adapter.connect(owner).configure(await market.getAddress(), owner.address);
    await adapter.connect(owner).configureRisk(await market.getAddress(), owner.address, 500);

    const collateralAmount = 100n * 10n ** 8n;
    const debtOwed = 500n * 10n ** 6n;
    const quotedMinimum = 700n * 10n ** 6n;
    await market.setLoan(collateralAmount, holder.address);
    await market.setQuote(quotedMinimum, true);
    await collateral.mint(await adapter.getAddress(), collateralAmount);
    await router.setOutputMultiplier(7n * 10n ** 16n);
    await lending.mint(await router.getAddress(), 1000n * 10n ** 6n);

    const holderBefore = await lending.balanceOf(holder.address);
    const result = await market.invokeLiquidation(await adapter.getAddress(), 0, debtOwed);
    const receipt = await result.wait();
    expect(receipt).to.not.equal(null);
    expect(await lending.balanceOf(await market.getAddress())).to.equal(debtOwed);
    expect(await lending.balanceOf(holder.address)).to.equal(holderBefore + quotedMinimum - debtOwed);
    expect(await collateral.balanceOf(await adapter.getAddress())).to.equal(0);
  });

  it("reverts and preserves handed-off collateral when router output misses the oracle floor", async function () {
    const [owner, holder] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const collateral = await Token.deploy("B20 AAPL", "AAPLc", 8);
    const lending = await Token.deploy("USD Coin", "USDC", 6);
    const Router = await ethers.getContractFactory("MockUniswapV3Router");
    const router = await Router.deploy();
    const Market = await ethers.getContractFactory("MockLiquidationMarket");
    const market = await Market.deploy(await collateral.getAddress(), await lending.getAddress(), holder.address);
    const Adapter = await ethers.getContractFactory("DEXSwapLiquidationAdapter");
    const adapter = await Adapter.deploy(owner.address);

    await adapter.connect(owner).addApprovedRouter(await router.getAddress());
    await adapter.connect(owner).setRouter(await router.getAddress());
    await adapter.connect(owner).configure(await market.getAddress(), owner.address);
    await adapter.connect(owner).configureRisk(await market.getAddress(), owner.address, 500);
    const collateralAmount = 100n * 10n ** 8n;
    const debtOwed = 500n * 10n ** 6n;
    await market.setLoan(collateralAmount, holder.address);
    await market.setQuote(700n * 10n ** 6n, true);
    await collateral.mint(await adapter.getAddress(), collateralAmount);
    await router.setOutputMultiplier(6n * 10n ** 16n);
    await lending.mint(await router.getAddress(), 1000n * 10n ** 6n);

    await expect(market.invokeLiquidation(await adapter.getAddress(), 0, debtOwed))
      .to.be.revertedWith("router slippage");
    expect(await collateral.balanceOf(await adapter.getAddress())).to.equal(collateralAmount);
  });

  it("fails closed when the liquidation quote is untrusted", async function () {
    const [owner, holder] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const collateral = await Token.deploy("B20 AAPL", "AAPLc", 8);
    const lending = await Token.deploy("USD Coin", "USDC", 6);
    const Router = await ethers.getContractFactory("MockUniswapV3Router");
    const router = await Router.deploy();
    const Market = await ethers.getContractFactory("MockLiquidationMarket");
    const market = await Market.deploy(await collateral.getAddress(), await lending.getAddress(), holder.address);
    const Adapter = await ethers.getContractFactory("DEXSwapLiquidationAdapter");
    const adapter = await Adapter.deploy(owner.address);

    await adapter.connect(owner).addApprovedRouter(await router.getAddress());
    await adapter.connect(owner).setRouter(await router.getAddress());
    await adapter.connect(owner).configure(await market.getAddress(), owner.address);
    await adapter.connect(owner).configureRisk(await market.getAddress(), owner.address, 500);
    const collateralAmount = 100n * 10n ** 8n;
    await market.setLoan(collateralAmount, holder.address);
    await market.setQuote(700n * 10n ** 6n, false);
    await collateral.mint(await adapter.getAddress(), collateralAmount);

    await expect(market.invokeLiquidation(await adapter.getAddress(), 0, 500n * 10n ** 6n))
      .to.be.revertedWith("Liquidation quote unavailable");
    expect(await collateral.balanceOf(await adapter.getAddress())).to.equal(collateralAmount);
  });
});
