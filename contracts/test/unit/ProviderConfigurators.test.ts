import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress } from "ethers";

// Review H7: caller-supplied maxStaleness must be bounded — an unbounded value
// effectively disables freshness detection (lending against a frozen Friday close).
describe("ProviderConfigurators staleness cap (H7)", function () {
  async function deploy() {
    const [admin, market, collateral, oracle, compliance] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const feed = await Token.deploy("Feed", "FEED", 18);

    const B20 = await ethers.getContractFactory("B20ProviderConfigurator");
    const b20 = await B20.deploy(admin.address);
    const RH = await ethers.getContractFactory("RobinhoodProviderConfigurator");
    const rh = await RH.deploy(admin.address);

    const dummyCollateral = collateral.address;
    const dummyOracle = oracle.address;
    const dummyCompliance = compliance.address;
    const feedAddr = await feed.getAddress();
    const providerData = (staleness: bigint) =>
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "address"],
        [feedAddr, staleness, ZeroAddress]
      );
    const providerDataRH = (staleness: bigint) =>
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "address"],
        [feedAddr, staleness, ZeroAddress]
      );
    return { admin, market, dummyCollateral, dummyOracle, dummyCompliance, feedAddr, b20, rh, providerData, providerDataRH };
  }

  it("B20 configurator rejects staleness above the 24h cap", async function () {
    const { admin, market, dummyCollateral, dummyOracle, dummyCompliance, b20, providerData } = await deploy();
    await expect(
      b20.connect(admin).configureMarket(
        market.address, dummyCollateral, ZeroAddress, dummyOracle, dummyCompliance, ZeroAddress,
        providerData(25n * 3600n)
      )
    ).to.be.revertedWith("B20 staleness out of bounds");
    await expect(
      b20.connect(admin).configureMarket(
        market.address, dummyCollateral, ZeroAddress, dummyOracle, dummyCompliance, ZeroAddress,
        providerData(2n ** 200n)
      )
    ).to.be.revertedWith("B20 staleness out of bounds");
  });

  it("Robinhood configurator rejects staleness above the 24h cap", async function () {
    const { admin, market, dummyCollateral, dummyOracle, dummyCompliance, rh, providerDataRH } = await deploy();
    await expect(
      rh.connect(admin).configureMarket(
        market.address, dummyCollateral, ZeroAddress, dummyOracle, dummyCompliance, ZeroAddress,
        providerDataRH(7n * 24n * 3600n)
      )
    ).to.be.revertedWith("Robinhood staleness out of bounds");
  });

  it("both configurators expose the 24h cap as a public constant", async function () {
    const { b20, rh } = await deploy();
    expect(await b20.MAX_STALENESS_SECONDS()).to.equal(24n * 3600n);
    expect(await rh.MAX_STALENESS_SECONDS()).to.equal(24n * 3600n);
  });
});
