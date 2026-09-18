import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress } from "ethers";

// Regression coverage for the Soulbound mint-blocking bug (pre-mainnet review C1):
// _beforeTokenTransfer previously required `to == address(0)` on every hook call,
// which also reverted on _safeMint (to = recipient) — loans could never originate.
//
// Production-faithful shape: the template is initializer-locked (review M8), so the
// fixture clones it via a minimal EIP-1167 proxy exactly like MarketFactoryV2 does.
describe("SoulboundPositionAdapter (C1 regression)", function () {
  async function deployClone() {
    const [factory, market, borrower, other] = await ethers.getSigners();
    const Adapter = await ethers.getContractFactory("SoulboundPositionAdapter");
    const template = await Adapter.deploy();
    // EIP-1167 minimal proxy creation code (matches OZ Clones.clone output)
    const impl = (await template.getAddress()).toLowerCase();
    const initCode =
      "0x3d602d80600a3d3981f3" +
      "363d3d373d3d3d363d73" +
      impl.slice(2) +
      "5af43d82803e903d91602b57fd5bf3";
    const tx = await factory.sendTransaction({ data: initCode });
    const receipt = await tx.wait();
    const adapter = await ethers.getContractAt("SoulboundPositionAdapter", receipt!.contractAddress!);
    await adapter.initialize(factory.address, ZeroAddress);
    await adapter.connect(factory).registerMarket(market.address);
    return { factory, market, borrower, other, adapter };
  }

  async function deploy() {
    return deployClone();
  }

  it("market can mint a position on borrow (previously always reverted)", async function () {
    const { market, borrower, adapter } = await deploy();
    await adapter.connect(market).mint(borrower.address, 0);
    expect(await adapter.ownerOf(0)).to.equal(borrower.address);
  });

  it("market can burn the position on repay/liquidation", async function () {
    const { market, borrower, adapter } = await deploy();
    await adapter.connect(market).mint(borrower.address, 0);
    await adapter.connect(market).burn(0);
    expect(await adapter.ownerOf(0)).to.equal(ZeroAddress);
  });

  it("peer-to-peer transfer remains blocked (soulbound semantics)", async function () {
    const { market, borrower, other, adapter } = await deploy();
    await adapter.connect(market).mint(borrower.address, 0);
    await expect(
      adapter.connect(borrower).transferFrom(borrower.address, other.address, 0)
    ).to.be.revertedWith("Soulbound: transfer not allowed");
    // approvals are inert
    await adapter.connect(borrower).approve(other.address, 0);
    await expect(
      adapter.connect(other).transferFrom(borrower.address, other.address, 0)
    ).to.be.revertedWith("Soulbound: transfer not allowed");
  });

  it("non-authorized callers cannot mint or burn", async function () {
    const { borrower, other, adapter } = await deploy();
    await expect(adapter.connect(borrower).mint(borrower.address, 0)).to.be.revertedWith("Unauthorized");
    await expect(adapter.connect(other).burn(0)).to.be.revertedWith("Unauthorized");
  });
});
