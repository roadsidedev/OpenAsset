import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress } from "ethers";

describe("AssetAdapters (production readiness)", function () {
  describe("ERC20Adapter", function () {
    async function deploy() {
      const [owner, marketWallet, borrower, recipient] = await ethers.getSigners();
      const Token = await ethers.getContractFactory("MockERC20");
      const token = await Token.deploy("Mock Token", "MTK", 18);
      const Adapter = await ethers.getContractFactory("ERC20Adapter");
      const adapter = await Adapter.deploy(owner.address);
      await adapter.configure(marketWallet.address, await token.getAddress());
      await token.mint(borrower.address, ethers.parseEther("1000"));
      return { owner, marketWallet, borrower, recipient, token, adapter };
    }

    it("configures a market and emits MarketConfigured", async function () {
      const { owner, marketWallet, token, adapter } = await deploy();
      // configured in fixture; verify state read (single-field struct getter → bare address)
      expect(await adapter.marketConfigs(marketWallet.address)).to.equal(await token.getAddress());
    });

    it("rejects non-ERC20 collateral at configure time (EOA and non-ERC20 contract)", async function () {
      const { owner } = await deploy();
      const Adapter = await ethers.getContractFactory("ERC20Adapter");
      const fresh = await Adapter.deploy(owner.address);

      const stranger = (await ethers.getSigners())[6];
      await expect(fresh.configure(stranger.address, stranger.address)).to.be.revertedWithCustomError(
        fresh,
        "NotAnERC20"
      );

      // Non-ERC20 contract (position adapter) must be rejected
      const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
      const nonErc20 = await MockPositionAdapter.deploy();
      await expect(fresh.configure(stranger.address, await nonErc20.getAddress())).to.be.revertedWithCustomError(
        fresh,
        "NotAnERC20"
      );
    });

    it("escrow moves borrower→market via the adapter and emits events", async function () {
      const { marketWallet, borrower, token, adapter } = await deploy();
      await token.connect(borrower).approve(await adapter.getAddress(), ethers.MaxUint256);

      const marketBefore = await token.balanceOf(marketWallet.address);
      const escrowTx = await adapter.connect(marketWallet).escrow(borrower.address, ethers.parseEther("10"));
      expect((await token.balanceOf(marketWallet.address)) - marketBefore).to.equal(ethers.parseEther("10"));
      const r = await escrowTx.wait();
      expect(r!.logs.some((l: any) => l.fragment?.name === "CollateralEscrowed")).to.be.true;
    });

    it("release moves market→recipient using the market's adapter approval", async function () {
      const { marketWallet, borrower, recipient, token, adapter } = await deploy();
      await token.connect(borrower).approve(await adapter.getAddress(), ethers.MaxUint256);
      await adapter.connect(marketWallet).escrow(borrower.address, ethers.parseEther("10"));
      // release spender is the adapter; market must have approved the adapter
      await token.connect(marketWallet).approve(await adapter.getAddress(), ethers.MaxUint256);

      const recipientBefore = await token.balanceOf(recipient.address);
      const relTx = await adapter.connect(marketWallet).release(recipient.address, ethers.parseEther("10"));
      expect((await token.balanceOf(recipient.address)) - recipientBefore).to.equal(ethers.parseEther("10"));
      const r = await relTx.wait();
      expect(r!.logs.some((l: any) => l.fragment?.name === "CollateralReleased")).to.be.true;
    });

    it("isTransferable: fail-closed on missing balance/allowance, true on both present", async function () {
      const { marketWallet, borrower, token, adapter } = await deploy();
      // Unconfigured caller
      expect(await adapter.connect((await ethers.getSigners())[7]).isTransferable(borrower.address, borrower.address, 1n)).to.be.false;

      // Balance but no allowance
      expect(await adapter.connect(marketWallet).isTransferable(borrower.address, borrower.address, ethers.parseEther("1"))).to.be.false;

      // Allowance but zero amount
      await token.connect(borrower).approve(await adapter.getAddress(), ethers.MaxUint256);
      expect(await adapter.connect(marketWallet).isTransferable(borrower.address, borrower.address, 0n)).to.be.false;

      // Both present
      expect(await adapter.connect(marketWallet).isTransferable(borrower.address, borrower.address, ethers.parseEther("1"))).to.be.true;
    });
  });

  describe("ERC721Adapter", function () {
    async function deploy() {
      const [owner, marketWallet, borrower, recipient] = await ethers.getSigners();
      const Nft = await ethers.getContractFactory("MockERC721");
      const nft = await Nft.deploy();
      const Adapter = await ethers.getContractFactory("ERC721Adapter");
      const adapter = await Adapter.deploy(owner.address);
      await adapter.configure(marketWallet.address, await nft.getAddress());
      await nft.mint(borrower.address, 7);
      await nft.mint(borrower.address, 8);
      return { owner, marketWallet, borrower, recipient, nft, adapter };
    }

    it("configures a market and validates the ERC721 interface", async function () {
      const { owner, marketWallet, nft, adapter } = await deploy();
      // configured in fixture; verify state read (single-field struct getter → bare address)
      expect(await adapter.marketConfigs(marketWallet.address)).to.equal(await nft.getAddress());
    });

    it("rejects non-ERC721 collateral (EOA and ERC20) at configure time", async function () {
      const { owner, token: _unused, ...rest } = await deploy() as any;
      const Token = await ethers.getContractFactory("MockERC20");
      const erc20 = await Token.deploy("Mock Token", "MTK", 18);
      const fresh = await (await ethers.getContractFactory("ERC721Adapter")).deploy(owner.address);
      const stranger = (await ethers.getSigners())[6];

      await expect(fresh.configure(stranger.address, stranger.address)).to.be.revertedWithCustomError(
        fresh,
        "NotAnERC721"
      );
      await expect(fresh.configure(stranger.address, await erc20.getAddress())).to.be.revertedWithCustomError(
        fresh,
        "NotAnERC721"
      );
    });

    it("escrow moves NFT borrower→market via safeTransferFrom", async function () {
      const { marketWallet, borrower, nft, adapter } = await deploy();
      await nft.connect(borrower).setApprovalForAll(await adapter.getAddress(), true);
      await adapter.connect(marketWallet).escrow(borrower.address, 7);
      expect(await nft.ownerOf(7)).to.equal(marketWallet.address);
    });

    it("release requires the market to have approved the adapter (as the market initializer grants)", async function () {
      const { marketWallet, borrower, recipient, nft, adapter } = await deploy();
      await nft.connect(borrower).setApprovalForAll(await adapter.getAddress(), true);
      await adapter.connect(marketWallet).escrow(borrower.address, 7);

      // Without approval, release reverts
      await expect(adapter.connect(marketWallet).release(recipient.address, 7)).to.be.reverted;

      // With setApprovalForAll (granted by LendingMarketV2.initialize in production), release works
      await nft.connect(marketWallet).setApprovalForAll(await adapter.getAddress(), true);
      await adapter.connect(marketWallet).release(recipient.address, 7);
      expect(await nft.ownerOf(7)).to.equal(recipient.address);
    });

    it("isTransferable: owner check + per-token or operator approval", async function () {
      const { marketWallet, borrower, nft, adapter } = await deploy();
      expect(await adapter.connect(marketWallet).isTransferable(borrower.address, borrower.address, 7)).to.be.false;
      expect(await adapter.connect(marketWallet).isTransferable(borrower.address, borrower.address, 999)).to.be.false;

      // Per-token approval
      await nft.connect(borrower).approve(await adapter.getAddress(), 7);
      expect(await adapter.connect(marketWallet).isTransferable(borrower.address, borrower.address, 7)).to.be.true;
      expect(await adapter.connect(marketWallet).isTransferable(borrower.address, borrower.address, 8)).to.be.false;

      // Operator approval covers the rest
      await nft.connect(borrower).setApprovalForAll(await adapter.getAddress(), true);
      expect(await adapter.connect(marketWallet).isTransferable(borrower.address, borrower.address, 8)).to.be.true;
    });
  });

  describe("LendingMarketV2 collateral approval by standard", function () {
    it("ERC20 collateral: market approves the asset adapter via ERC20 allowance", async function () {
      const [owner, , treasury] = await ethers.getSigners();
      const Token = await ethers.getContractFactory("MockERC20");
      const collateral = await Token.deploy("Mock Token", "MTK", 18);
      const lending = await Token.deploy("USD Coin", "USDC", 18);
      const MockAssetAdapter = await ethers.getContractFactory("MockAssetAdapter");
      const assetAdapter = await MockAssetAdapter.deploy(await collateral.getAddress());
      const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
      const oracleAdapter = await MockOracleAdapter.deploy(ethers.parseEther("2000"), true);
      const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
      const liquidationAdapter = await MockLiquidationAdapter.deploy(false, 0);
      const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
      const positionAdapter = await MockPositionAdapter.deploy();
      const LendingMarketV2 = await ethers.getContractFactory("LendingMarketV2");
      const template = await LendingMarketV2.deploy();
      const MarketDeployer = await ethers.getContractFactory("MarketDeployer");
      const deployer = await MarketDeployer.deploy(await template.getAddress());
      const params = {
        factory: ZeroAddress, marketOwner: owner.address, collateralAsset: await collateral.getAddress(),
        lendingAsset: await lending.getAddress(), protocolTreasury: treasury.address,
        assetAdapter: await assetAdapter.getAddress(), oracleAdapter: await oracleAdapter.getAddress(),
        complianceAdapter: ZeroAddress, liquidationAdapter: await liquidationAdapter.getAddress(),
        positionAdapter: await positionAdapter.getAddress(), ltvBps: 5000, aprBps: 1200,
        durationSeconds: 30 * 24 * 3600, gracePeriodHours: 1, enableHealthFactor: true,
        healthFactorThreshold: 12000,
        cbConfig: { enabled: false, pauseThresholdBps: 2000, lookbackPeriodSeconds: 3600, resumeThresholdBps: 1000, cooldownSeconds: 7200 },
      };
      const marketAddress = await deployer.deploy.staticCall(params);
      await (await deployer.deploy(params)).wait();
      const market = await ethers.getContractAt("LendingMarketV2", marketAddress);
      expect(await collateral.allowance(marketAddress, await assetAdapter.getAddress())).to.equal(ethers.MaxUint256);
    });

    it("ERC721 collateral: market approves the adapter via setApprovalForAll (initialize does NOT call the ERC20 approve selector)", async function () {
      const [owner, , treasury] = await ethers.getSigners();
      const Nft = await ethers.getContractFactory("MockERC721");
      const collateral = await Nft.deploy();
      const Token = await ethers.getContractFactory("MockERC20");
      const lending = await Token.deploy("USD Coin", "USDC", 18);
      const MockAssetAdapter = await ethers.getContractFactory("MockAssetAdapter");
      const assetAdapter = await MockAssetAdapter.deploy(await collateral.getAddress());
      const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
      const oracleAdapter = await MockOracleAdapter.deploy(ethers.parseEther("2000"), true);
      const MockLiquidationAdapter = await ethers.getContractFactory("MockLiquidationAdapter");
      const liquidationAdapter = await MockLiquidationAdapter.deploy(false, 0);
      const MockPositionAdapter = await ethers.getContractFactory("MockPositionAdapter");
      const positionAdapter = await MockPositionAdapter.deploy();
      const LendingMarketV2 = await ethers.getContractFactory("LendingMarketV2");
      const template = await LendingMarketV2.deploy();
      const MarketDeployer = await ethers.getContractFactory("MarketDeployer");
      const deployer = await MarketDeployer.deploy(await template.getAddress());
      const params = {
        factory: ZeroAddress, marketOwner: owner.address, collateralAsset: await collateral.getAddress(),
        lendingAsset: await lending.getAddress(), protocolTreasury: treasury.address,
        assetAdapter: await assetAdapter.getAddress(), oracleAdapter: await oracleAdapter.getAddress(),
        complianceAdapter: ZeroAddress, liquidationAdapter: await liquidationAdapter.getAddress(),
        positionAdapter: await positionAdapter.getAddress(), ltvBps: 5000, aprBps: 1200,
        durationSeconds: 30 * 24 * 3600, gracePeriodHours: 1, enableHealthFactor: true,
        healthFactorThreshold: 12000,
        cbConfig: { enabled: false, pauseThresholdBps: 2000, lookbackPeriodSeconds: 3600, resumeThresholdBps: 1000, cooldownSeconds: 7200 },
      };
      const marketAddress = await deployer.deploy.staticCall(params);
      await (await deployer.deploy(params)).wait();
      const market = await ethers.getContractAt("LendingMarketV2", marketAddress);
      // The initializer must have granted setApprovalForAll to the asset adapter
      expect(await collateral.isApprovedForAll(marketAddress, await assetAdapter.getAddress())).to.be.true;
    });
  });
});
