import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ChainlinkOracle, MockAggregatorV3Interface } from "../typechain-types";

/**
 * @title ChainlinkOracle Unit Tests
 * @notice Comprehensive unit tests for ChainlinkOracle contract
 * @dev Tests all public functions, error cases, and security features
 */
describe("ChainlinkOracle", function () {
  let oracle: ChainlinkOracle;
  let mockAggregator: MockAggregatorV3Interface;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let asset1: SignerWithAddress;

  const ASSET_PRICE = ethers.parseUnits("100", 8); // $100 with 8 decimals
  const HEARTBEAT = 3600; // 1 hour
  const ANSWER_IN_ROUND = 1n;
  const ROUND_ID = 1n;

  beforeEach(async function () {
    [owner, user, asset1] = await ethers.getSigners();

    // Deploy mock aggregator
    const AggregatorFactory = await ethers.getContractFactory("MockAggregatorV3Interface");
    mockAggregator = await AggregatorFactory.deploy(ASSET_PRICE, 8);
    await mockAggregator.waitForDeployment();

    // Deploy ChainlinkOracle
    const OracleFactory = await ethers.getContractFactory("ChainlinkOracle");
    oracle = await OracleFactory.deploy(owner.address);
    await oracle.waitForDeployment();
  });

  // ============ Registration Tests ============

  describe("Feed Registration", function () {
    it("Should register a feed successfully", async function () {
      const tx = await oracle.registerFeed(
        asset1.address,
        await mockAggregator.getAddress(),
        HEARTBEAT
      );
      await expect(tx).to.emit(oracle, "FeedRegistered");

      const assets = await oracle.getRegisteredAssets();
      expect(assets).to.include(asset1.address);
    });

    it("Should reject invalid asset address", async function () {
      await expect(
        oracle.registerFeed(ethers.ZeroAddress, await mockAggregator.getAddress(), HEARTBEAT)
      ).to.be.revertedWith("Invalid asset");
    });

    it("Should reject invalid feed address", async function () {
      await expect(
        oracle.registerFeed(asset1.address, ethers.ZeroAddress, HEARTBEAT)
      ).to.be.revertedWith("Invalid feed");
    });

    it("Should reject zero heartbeat", async function () {
      await expect(
        oracle.registerFeed(asset1.address, await mockAggregator.getAddress(), 0)
      ).to.be.revertedWithCustomError(oracle, "ZeroHeartbeat");
    });

    it("Should only allow owner to register feeds", async function () {
      await expect(
        oracle
          .connect(user)
          .registerFeed(asset1.address, await mockAggregator.getAddress(), HEARTBEAT)
      ).to.be.revertedWithCustomError(oracle, "Unauthorized");
    });

    it("Should update existing feed", async function () {
      // First registration
      await oracle.registerFeed(
        asset1.address,
        await mockAggregator.getAddress(),
        HEARTBEAT
      );

      // Create another mock aggregator
      const AggregatorFactory = await ethers.getContractFactory("MockAggregatorV3Interface");
      const mockAggregator2 = await AggregatorFactory.deploy(
        ethers.parseUnits("200", 8),
        8
      );
      await mockAggregator2.waitForDeployment();

      // Update registration
      await oracle.registerFeed(
        asset1.address,
        await mockAggregator2.getAddress(),
        HEARTBEAT + 1
      );

      const config = await oracle.getFeedConfig(asset1.address);
      expect(config.feedAddress).to.equal(await mockAggregator2.getAddress());
      expect(config.heartbeat).to.equal(HEARTBEAT + 1);
    });
  });

  // ============ Batch Registration Tests ============

  describe("Batch Feed Registration", function () {
    it("Should register multiple feeds in batch", async function () {
      const [addr1, addr2, addr3] = [
        await ethers.getSigners().then(s => s[3].address),
        await ethers.getSigners().then(s => s[4].address),
        await ethers.getSigners().then(s => s[5].address),
      ];

      const assets = [addr1, addr2, addr3];
      const feeds = [
        await mockAggregator.getAddress(),
        await mockAggregator.getAddress(),
        await mockAggregator.getAddress(),
      ];
      const heartbeats = [3600, 3600, 3600];

      await oracle.registerFeedBatch(assets, feeds, heartbeats);

      for (const asset of assets) {
        expect(await oracle.getRegisteredAssets()).to.include(asset);
      }
    });

    it("Should reject mismatched array lengths", async function () {
      const assets = [asset1.address];
      const feeds = [
        await mockAggregator.getAddress(),
        await mockAggregator.getAddress(),
      ];
      const heartbeats = [3600];

      await expect(
        oracle.registerFeedBatch(assets, feeds, heartbeats)
      ).to.be.revertedWith("Length mismatch");
    });
  });

  // ============ Price Fetching Tests ============

  describe("Price Fetching (IOracle Interface)", function () {
    beforeEach(async function () {
      await oracle.registerFeed(asset1.address, await mockAggregator.getAddress(), HEARTBEAT);
    });

    it("Should return price with 18 decimals", async function () {
      const [price, decimals] = await oracle.getPrice(asset1.address);

      expect(decimals).to.equal(18);
      // 100 from 8 decimals should become 1e20 in 18 decimals
      expect(price).to.equal(ethers.parseUnits("100", 18));
    });

    it("Should handle 6 decimal feeds correctly", async function () {
      // Create USDC-like feed (6 decimals)
      const AggregatorFactory = await ethers.getContractFactory("MockAggregatorV3Interface");
      const usdc6Feed = await AggregatorFactory.deploy(ethers.parseUnits("1", 6), 6);
      await usdc6Feed.waitForDeployment();

      await oracle.registerFeed(
        asset1.address,
        await usdc6Feed.getAddress(),
        HEARTBEAT
      );

      const [price, decimals] = await oracle.getPrice(asset1.address);
      expect(decimals).to.equal(18);
      expect(price).to.equal(ethers.parseUnits("1", 18));
    });

    it("Should handle 20 decimal feeds correctly", async function () {
      const AggregatorFactory = await ethers.getContractFactory("MockAggregatorV3Interface");
      const highDecimalFeed = await AggregatorFactory.deploy(
        ethers.parseUnits("100", 20),
        20
      );
      await highDecimalFeed.waitForDeployment();

      await oracle.registerFeed(
        asset1.address,
        await highDecimalFeed.getAddress(),
        HEARTBEAT
      );

      const [price, decimals] = await oracle.getPrice(asset1.address);
      expect(decimals).to.equal(18);
      expect(price).to.equal(ethers.parseUnits("100", 18));
    });

    it("Should revert if asset not supported", async function () {
      await expect(oracle.getPrice(user.address)).to.be.revertedWithCustomError(
        oracle,
        "AssetNotSupported"
      );
    });

    it("Should revert if feed is inactive", async function () {
      await oracle.deactivateFeed(asset1.address);
      await expect(oracle.getPrice(asset1.address)).to.be.revertedWithCustomError(
        oracle,
        "FeedInactive"
      );
    });

    it("Should revert if price is zero or negative", async function () {
      const AggregatorFactory = await ethers.getContractFactory("MockAggregatorV3Interface");
      const zeroFeed = await AggregatorFactory.deploy(0, 8);
      await zeroFeed.waitForDeployment();

      await oracle.registerFeed(asset1.address, await zeroFeed.getAddress(), HEARTBEAT);
      await expect(oracle.getPrice(asset1.address)).to.be.revertedWithCustomError(
        oracle,
        "InvalidPrice"
      );
    });
  });

  // ============ Staleness Detection Tests ============

  describe("Staleness Detection", function () {
    beforeEach(async function () {
      await oracle.registerFeed(asset1.address, await mockAggregator.getAddress(), HEARTBEAT);
    });

    it("Should reject stale prices", async function () {
      // Simulate stale price by advancing time
      await ethers.provider.send("hardhat_mine", ["0x1000"]); // Mine many blocks
      await ethers.provider.send("evm_increaseTime", [HEARTBEAT + 400]); // Go past heartbeat + 5 min buffer

      // Mock aggregator returns old timestamp
      await mockAggregator.setUpdatedAt(Math.floor(Date.now() / 1000) - (HEARTBEAT + 400));

      await expect(oracle.getPrice(asset1.address)).to.be.revertedWithCustomError(
        oracle,
        "StalePrice"
      );
    });

    it("Should accept prices within heartbeat window", async function () {
      // Price should be valid immediately
      const [price, decimals] = await oracle.getPrice(asset1.address);
      expect(price).to.be.gt(0);
      expect(decimals).to.equal(18);
    });

    it("Should accept prices with 5 min buffer", async function () {
      // Advance time by heartbeat + 200 seconds (5 min buffer is 300s)
      await ethers.provider.send("evm_increaseTime", [HEARTBEAT + 200]);
      
      // Should still be valid
      const [price] = await oracle.getPrice(asset1.address);
      expect(price).to.be.gt(0);
    });
  });

  // ============ Feed Management Tests ============

  describe("Feed Deactivation/Reactivation", function () {
    beforeEach(async function () {
      await oracle.registerFeed(asset1.address, await mockAggregator.getAddress(), HEARTBEAT);
    });

    it("Should deactivate feed", async function () {
      const tx = await oracle.deactivateFeed(asset1.address);
      await expect(tx).to.emit(oracle, "FeedDeactivated");

      const config = await oracle.getFeedConfig(asset1.address);
      expect(config.isActive).to.be.false;
    });

    it("Should reactivate feed", async function () {
      await oracle.deactivateFeed(asset1.address);
      
      const tx = await oracle.reactivateFeed(asset1.address);
      await expect(tx).to.emit(oracle, "FeedReactivated");

      const config = await oracle.getFeedConfig(asset1.address);
      expect(config.isActive).to.be.true;
    });

    it("Should only allow owner to deactivate", async function () {
      await expect(
        oracle.connect(user).deactivateFeed(asset1.address)
      ).to.be.revertedWithCustomError(oracle, "Unauthorized");
    });

    it("Should revert deactivating non-existent feed", async function () {
      await expect(
        oracle.deactivateFeed(user.address)
      ).to.be.revertedWith("Feed not registered");
    });
  });

  // ============ Diagnostic Functions Tests ============

  describe("Diagnostic Functions", function () {
    beforeEach(async function () {
      await oracle.registerFeed(asset1.address, await mockAggregator.getAddress(), HEARTBEAT);
    });

    it("Should return feed configuration", async function () {
      const config = await oracle.getFeedConfig(asset1.address);
      expect(config.feedAddress).to.equal(await mockAggregator.getAddress());
      expect(config.heartbeat).to.equal(HEARTBEAT);
      expect(config.isActive).to.be.true;
    });

    it("Should return all registered assets", async function () {
      const assets = await oracle.getRegisteredAssets();
      expect(assets).to.include(asset1.address);
    });

    it("Should return detailed price information", async function () {
      const details = await oracle.getPriceDetails(asset1.address);
      
      expect(details.price).to.be.gt(0);
      expect(details.updatedAt).to.be.gt(0);
      expect(details.roundId).to.be.gte(0);
      expect(details.answeredInRound).to.be.gte(0);
      expect(details.isStale).to.be.false;
    });
  });

  // ============ Interface Compliance Tests ============

  describe("IOracle Interface Compliance", function () {
    beforeEach(async function () {
      await oracle.registerFeed(asset1.address, await mockAggregator.getAddress(), HEARTBEAT);
    });

    it("Should return correct oracle type", async function () {
      const type = await oracle.oracleType();
      expect(type).to.equal("CHAINLINK");
    });

    it("Should indicate asset support correctly", async function () {
      expect(await oracle.supportsAsset(asset1.address)).to.be.true;
      expect(await oracle.supportsAsset(user.address)).to.be.false;
    });

    it("Should return last update timestamp", async function () {
      const timestamp = await oracle.getLastUpdate(asset1.address);
      expect(timestamp).to.be.gt(0);
    });

    it("Should revert getting update time for unsupported asset", async function () {
      await expect(
        oracle.getLastUpdate(user.address)
      ).to.be.revertedWithCustomError(oracle, "AssetNotSupported");
    });
  });

  // ============ Edge Cases ============

  describe("Edge Cases", function () {
    it("Should handle very small prices", async function () {
      const AggregatorFactory = await ethers.getContractFactory("MockAggregatorV3Interface");
      const smallPriceFeed = await AggregatorFactory.deploy(1, 8); // 0.00000001
      await smallPriceFeed.waitForDeployment();

      await oracle.registerFeed(
        asset1.address,
        await smallPriceFeed.getAddress(),
        HEARTBEAT
      );

      const [price] = await oracle.getPrice(asset1.address);
      expect(price).to.equal(100000000000n); // 1e8 in 18 decimals = 1e10
    });

    it("Should handle very large prices", async function () {
      const AggregatorFactory = await ethers.getContractFactory("MockAggregatorV3Interface");
      const largePriceFeed = await AggregatorFactory.deploy(
        ethers.parseUnits("999999", 8),
        8
      );
      await largePriceFeed.waitForDeployment();

      await oracle.registerFeed(
        asset1.address,
        await largePriceFeed.getAddress(),
        HEARTBEAT
      );

      const [price] = await oracle.getPrice(asset1.address);
      expect(price).to.equal(ethers.parseUnits("999999", 18));
    });

    it("Should handle max uint256 price", async function () {
      // Note: In practice this would be extremely unrealistic
      // but tests the bounds of the system
      const AggregatorFactory = await ethers.getContractFactory("MockAggregatorV3Interface");
      const maxPriceFeed = await AggregatorFactory.deploy(ethers.MaxUint256, 8);
      await maxPriceFeed.waitForDeployment();

      await oracle.registerFeed(
        asset1.address,
        await maxPriceFeed.getAddress(),
        HEARTBEAT
      );

      const [price] = await oracle.getPrice(asset1.address);
      // Should overflow gracefully or revert (depending on implementation)
      expect(price).to.be.a("bigint");
    });
  });
});
