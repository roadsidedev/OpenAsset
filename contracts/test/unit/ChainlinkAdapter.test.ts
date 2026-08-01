import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

async function latestTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return block ? block.timestamp : 0;
}

async function increaseTime(seconds: number): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

// eth_call getPrice() as an arbitrary market address (bypasses hardhat signer validation)
async function callGetPrice(adapter: any, from: string): Promise<[bigint, boolean, bigint]> {
  const result = await ethers.provider.call({
    from,
    to: await adapter.getAddress(),
    data: adapter.interface.encodeFunctionData("getPrice"),
  });
  const decoded = adapter.interface.decodeFunctionResult("getPrice", result);
  return [decoded.price as bigint, decoded.isTrusted as boolean, decoded.updatedAt as bigint];
}

describe("ChainlinkAdapter", function () {
  let factory: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let adapter: any;
  let feed: any;
  let sequencer: any;
  let marketA: any;
  let marketB: any;

  const ASSET_A = "0x1111111111111111111111111111111111111111";
  const ASSET_B = "0x2222222222222222222222222222222222222222";

  beforeEach(async function () {
    [factory, owner, other] = await ethers.getSigners();

    const Adapter = await ethers.getContractFactory("ChainlinkAdapter");
    adapter = await Adapter.deploy(await factory.getAddress(), await owner.getAddress());

    const MockFeed = await ethers.getContractFactory("MockChainlinkFeed");
    feed = await MockFeed.deploy(2000n * 10n ** 8n, 8, 0); // $2000 with 8 feed decimals
    sequencer = await MockFeed.deploy(0, 0, 0); // answer 0 = sequencer up

    marketA = await ethers.Wallet.createRandom();
    marketB = await ethers.Wallet.createRandom();
  });

  describe("Access control", function () {
    it("should set factory and owner from constructor", async function () {
      expect(await adapter.factory()).to.equal(await factory.getAddress());
      expect(await adapter.owner()).to.equal(await owner.getAddress());
    });

    it("should only allow factory to call configure", async function () {
      await expect(adapter.connect(other).configure(marketA.address, ASSET_A)).to.be.revertedWith("Only factory");
    });

    it("should only allow owner to register feeds", async function () {
      await expect(
        adapter.connect(other).registerFeed(ASSET_A, await feed.getAddress(), 3600)
      ).to.be.revertedWith("Only owner");
    });

    it("should transfer owner", async function () {
      await adapter.connect(owner).transferOwner(other.address);
      expect(await adapter.owner()).to.equal(other.address);
      await expect(adapter.connect(owner).registerFeed(ASSET_A, await feed.getAddress(), 3600)).to.be.revertedWith(
        "Only owner"
      );
    });
  });

  describe("Feed registration + configure", function () {
    it("should register feed per asset", async function () {
      await adapter.connect(owner).registerFeed(ASSET_A, await feed.getAddress(), 3600);
      const cfg = await adapter.assetFeeds(ASSET_A);
      expect(cfg.feed).to.equal(await feed.getAddress());
      expect(cfg.maxStaleness).to.equal(3600);
    });

    it("should default staleness to 3600 when 0 passed", async function () {
      await adapter.connect(owner).registerFeed(ASSET_A, await feed.getAddress(), 0);
      const cfg = await adapter.assetFeeds(ASSET_A);
      expect(cfg.maxStaleness).to.equal(3600);
    });

    it("should reject zero feed address", async function () {
      await expect(adapter.connect(owner).registerFeed(ASSET_A, ethers.ZeroAddress, 3600)).to.be.revertedWith(
        "Invalid feed"
      );
    });

    it("should configure market to asset via factory", async function () {
      await adapter.connect(factory).configure(marketA.address, ASSET_A);
      expect(await adapter.marketAssets(marketA.address)).to.equal(ASSET_A);
    });

    it("should resolve registered feed dynamically in getPrice", async function () {
      await adapter.connect(factory).configure(marketA.address, ASSET_A);
      // No feed registered yet => untrusted
      let [price, trusted, updated] = await callGetPrice(adapter, marketA.address);
      expect(price).to.equal(0);
      expect(trusted).to.equal(false);

      // Register feed => now trusted
      await adapter.connect(owner).registerFeed(ASSET_A, await feed.getAddress(), 3600);
      [price, trusted, updated] = await callGetPrice(adapter, marketA.address);
      expect(trusted).to.equal(true);
      expect(price).to.equal(ethers.parseEther("2000")); // normalized to 18 decimals
      expect(updated).to.be.greaterThan(0);
    });
  });

  describe("getPrice", function () {
    beforeEach(async function () {
      await adapter.connect(owner).registerFeed(ASSET_A, await feed.getAddress(), 3600);
      await adapter.connect(factory).configure(marketA.address, ASSET_A);
    });

    it("should return untrusted when feed not registered for market asset", async function () {
      await adapter.connect(factory).configure(marketB.address, ASSET_B); // no feed for B
      const [price, trusted] = await callGetPrice(adapter, marketB.address);
      expect(price).to.equal(0);
      expect(trusted).to.equal(false);
    });

    it("should return untrusted when answer is stale", async function () {
      await feed.setAnswerAndTimestamp(ethers.parseEther("2000"), (await latestTimestamp()) - 4000); // 4000s old > 3600
      const [, trusted] = await callGetPrice(adapter, marketA.address);
      expect(trusted).to.equal(false);
    });

    it("should return untrusted when answer is zero or negative", async function () {
      await feed.setAnswer(0);
      const [, trusted] = await callGetPrice(adapter, marketA.address);
      expect(trusted).to.equal(false);

      await feed.setAnswer(-1);
      const [price, trusted2] = await callGetPrice(adapter, marketA.address);
      expect(price).to.equal(0);
      expect(trusted2).to.equal(false);
    });

    it("should normalize decimals to 18", async function () {
      await feed.setAnswer(2000 * 10 ** 8); // 8 decimals
      const [price] = await callGetPrice(adapter, marketA.address);
      expect(price).to.equal(ethers.parseEther("2000"));
    });
  });

  describe("L2 sequencer check", function () {
    beforeEach(async function () {
      await adapter.connect(owner).registerFeed(ASSET_A, await feed.getAddress(), 3600);
      await adapter.connect(factory).configure(marketA.address, ASSET_A);
    });

    it("should be trusted when no sequencer feed set", async function () {
      const [, trusted] = await callGetPrice(adapter, marketA.address);
      expect(trusted).to.equal(true);
    });

    it("should return untrusted when sequencer is down", async function () {
      await adapter.connect(owner).setL2SequencerFeed(await sequencer.getAddress());
      await sequencer.setAnswer(1); // down
      const [, trusted] = await callGetPrice(adapter, marketA.address);
      expect(trusted).to.equal(false);
    });

    it("should return untrusted during grace period after sequencer returns", async function () {
      await adapter.connect(owner).setL2SequencerFeed(await sequencer.getAddress());
      const now = await latestTimestamp();
      await sequencer.setStartedAt(now); // just came back up -> within grace period
      await sequencer.setAnswer(0); // up
      const [, trusted] = await callGetPrice(adapter, marketA.address);
      expect(trusted).to.equal(false);
    });

    it("should be trusted after grace period passes", async function () {
      await adapter.connect(owner).setL2SequencerFeed(await sequencer.getAddress());
      const now = await latestTimestamp();
      await sequencer.setStartedAt(now - 4000); // back up for 4000s > 3600 grace
      await sequencer.setAnswer(0); // up
      const [, trusted] = await callGetPrice(adapter, marketA.address);
      expect(trusted).to.equal(true);
    });

    it("should only allow owner to set sequencer feed", async function () {
      await expect(adapter.connect(other).setL2SequencerFeed(await sequencer.getAddress())).to.be.revertedWith(
        "Only owner"
      );
    });
  });
});
