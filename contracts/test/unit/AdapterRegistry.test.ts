import { expect } from "chai";
import { ethers } from "hardhat";
import { AdapterRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AdapterRegistry", function () {
  let registry: AdapterRegistry;
  let governance: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    [governance, user1, user2] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("AdapterRegistry");
    registry = await Registry.deploy(governance.address);
  });

  describe("Registration", function () {
    it("should register a new adapter", async function () {
      const adapter = user1.address;
      await registry.connect(user1).registerAdapter(adapter, 0); // ASSET type

      const info = await registry.getAdapterInfo(adapter);
      expect(info.adapterAddress).to.equal(adapter);
      expect(info.adapterType).to.equal(0);
      expect(info.registeredBy).to.equal(user1.address);
      expect(info.verified).to.be.false;
      expect(info.deprecated).to.be.false;
    });

    it("should revert when registering zero address", async function () {
      await expect(
        registry.connect(user1).registerAdapter(ethers.ZeroAddress, 0)
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });

    it("should revert when registering duplicate", async function () {
      await registry.connect(user1).registerAdapter(user1.address, 0);
      await expect(
        registry.connect(user1).registerAdapter(user1.address, 1)
      ).to.be.revertedWithCustomError(registry, "AlreadyRegistered");
    });

    it("should track adapters by type", async function () {
      await registry.registerAdapter(user1.address, 0); // ASSET
      await registry.registerAdapter(user2.address, 1); // ORACLE

      const assetAdapters = await registry.getAdaptersByType(0);
      expect(assetAdapters.length).to.equal(1);
      expect(assetAdapters[0]).to.equal(user1.address);

      const oracleAdapters = await registry.getAdaptersByType(1);
      expect(oracleAdapters.length).to.equal(1);
      expect(oracleAdapters[0]).to.equal(user2.address);
    });

    it("should track all adapters", async function () {
      await registry.registerAdapter(user1.address, 0);
      await registry.registerAdapter(user2.address, 1);

      const all = await registry.getAllAdapters();
      expect(all.length).to.equal(2);
    });
  });

  describe("Verification", function () {
    beforeEach(async function () {
      await registry.registerAdapter(user1.address, 0);
    });

    it("should mark adapter as verified by governance", async function () {
      await registry.connect(governance).markVerified(user1.address, "Audit #123");

      const info = await registry.getAdapterInfo(user1.address);
      expect(info.verified).to.be.true;
      expect(info.auditReference).to.equal("Audit #123");
    });

    it("should revert when non-governance tries to verify", async function () {
      await expect(
        registry.connect(user1).markVerified(user1.address, "Audit #123")
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("should revert when verifying unregistered adapter", async function () {
      await expect(
        registry.connect(governance).markVerified(user2.address, "Audit #123")
      ).to.be.revertedWithCustomError(registry, "NotRegistered");
    });
  });

  describe("Deprecation", function () {
    beforeEach(async function () {
      await registry.registerAdapter(user1.address, 0);
    });

    it("should mark adapter as deprecated by governance", async function () {
      await registry.connect(governance).markDeprecated(user1.address, "Security issue");

      const info = await registry.getAdapterInfo(user1.address);
      expect(info.deprecated).to.be.true;
    });

    it("should make deprecated adapter not selectable", async function () {
      expect(await registry.isSelectable(user1.address)).to.be.true;

      await registry.connect(governance).markDeprecated(user1.address, "Security issue");

      expect(await registry.isSelectable(user1.address)).to.be.false;
    });

    it("should revert when non-governance tries to deprecate", async function () {
      await expect(
        registry.connect(user1).markDeprecated(user1.address, "Security issue")
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });
  });

  describe("View Functions", function () {
    it("should return correct adapter count by type", async function () {
      await registry.registerAdapter(user1.address, 0);
      await registry.registerAdapter(user2.address, 0);

      expect(await registry.adapterCountByType(0)).to.equal(2);
      expect(await registry.adapterCountByType(1)).to.equal(0);
    });

    it("should return correct total count", async function () {
      await registry.registerAdapter(user1.address, 0);
      expect(await registry.getTotalAdapterCount()).to.equal(1);
    });
  });

  describe("Governance Transfer", function () {
    it("should transfer governance", async function () {
      await registry.connect(governance).setAuditGovernance(user1.address);
      expect(await registry.auditGovernance()).to.equal(user1.address);
    });

    it("should revert when non-governance tries to transfer", async function () {
      await expect(
        registry.connect(user1).setAuditGovernance(user2.address)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("should revert when transferring to zero address", async function () {
      await expect(
        registry.connect(governance).setAuditGovernance(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });
  });
});
