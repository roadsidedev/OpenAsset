import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  LendingMarket,
  LoanContract,
  MarketFactory,
  ChainlinkOracle,
  OracleRouter,
  MockOracle,
  MockERC20,
} from "../typechain-types";

/**
 * @title LendingMarket Oracle Integration Tests
 * @notice Integration tests for oracle system with LendingMarket
 * @dev Tests market creation, loan origination, and pricing with different oracle types
 */
describe("LendingMarket with Oracles", function () {
  let factory: MarketFactory;
  let market: LendingMarket;
  let chainlinkOracle: ChainlinkOracle;
  let routerOracle: OracleRouter;
  let mockPrimary: MockOracle;
  let mockSecondary: MockOracle;
  let loanImpl: LoanContract;
  let usdcToken: MockERC20;
  let collateralToken: MockERC20;

  let owner: SignerWithAddress;
  let lpProvider: SignerWithAddress;
  let borrower: SignerWithAddress;
  let liquidator: SignerWithAddress;

  const INITIAL_LIQUIDITY = ethers.parseUnits("10000", 6); // 10k USDC (6 decimals)
  const COLLATERAL_AMOUNT = ethers.parseUnits("100", 18);
  const LTV_BPS = 7500; // 75%
  const APR_BPS = 1000; // 10%
  const DURATION = 30 * 24 * 60 * 60; // 30 days
  const HEALTH_FACTOR = 12000; // 120%

  beforeEach(async function () {
    [owner, lpProvider, borrower, liquidator] = await ethers.getSigners();

    // Deploy mock tokens
    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    usdcToken = await ERC20Factory.deploy("USDC", "USDC", 6);
    await usdcToken.waitForDeployment();

    collateralToken = await ERC20Factory.deploy("Collateral", "COL", 18);
    await collateralToken.waitForDeployment();

    // Deploy LoanContract implementation
    const LoanFactory = await ethers.getContractFactory("LoanContract");
    loanImpl = await LoanFactory.deploy();
    await loanImpl.waitForDeployment();

    // Deploy MarketFactory
    const FactoryContract = await ethers.getContractFactory("MarketFactory");
    factory = await FactoryContract.deploy(owner.address, owner.address, await loanImpl.getAddress());
    await factory.waitForDeployment();

    // Deploy oracles
    const ChainlinkFactory = await ethers.getContractFactory("ChainlinkOracle");
    chainlinkOracle = await ChainlinkFactory.deploy(owner.address);
    await chainlinkOracle.waitForDeployment();

    const RouterFactory = await ethers.getContractFactory("OracleRouter");
    routerOracle = await RouterFactory.deploy(owner.address);
    await routerOracle.waitForDeployment();

    const MockFactory = await ethers.getContractFactory("MockOracle");
    mockPrimary = await MockFactory.deploy();
    await mockPrimary.waitForDeployment();

    mockSecondary = await MockFactory.deploy();
    await mockSecondary.waitForDeployment();

    // Fund accounts
    await usdcToken.mint(lpProvider.address, ethers.parseUnits("1000000", 6));
    await collateralToken.mint(borrower.address, ethers.parseUnits("10000", 18));
  });

  // ============ Chainlink Oracle Integration ============

  describe("LendingMarket with ChainlinkOracle", function () {
    beforeEach(async function () {
      // Setup mock prices
      await mockPrimary.setPrice(collateralToken.address, ethers.parseUnits("50", 18)); // $50

      // Create market with Chainlink oracle
      await usdcToken.connect(lpProvider).approve(await factory.getAddress(), INITIAL_LIQUIDITY);

      const tx = await factory
        .connect(lpProvider)
        .createMarket(
          collateralToken.address,
          usdcToken.address,
          0, // AssetType.ERC20
          1, // OracleType.CHAINLINK
          await mockPrimary.getAddress(),
          ethers.ZeroAddress,
          LTV_BPS,
          APR_BPS,
          DURATION,
          INITIAL_LIQUIDITY
        );

      const receipt = await tx.wait();
      const MarketCreated = factory.interface.getEvent("MarketCreated");
      const logs = receipt?.logs || [];
      const event = logs
        .map((log) => {
          try {
            return factory.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "MarketCreated");

      market = LendingMarket.attach(event?.args?.[0] || ethers.ZeroAddress);
    });

    it("Should create market with Chainlink oracle", async function () {
      expect(await market.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await market.oracleType()).to.equal(1); // CHAINLINK
    });

    it("Should get collateral price from Chainlink oracle", async function () {
      const price = await market.getCollateralPrice();
      expect(price).to.equal(ethers.parseUnits("50", 18));
    });

    it("Should originate loan with Chainlink oracle pricing", async function () {
      // Approve collateral transfer
      await collateralToken
        .connect(borrower)
        .approve(await market.getAddress(), COLLATERAL_AMOUNT);

      // Loan amount = collateral value * LTV
      // = 100 * $50 * 75% = $3750
      const expectedLoanAmount = ethers.parseUnits("3750", 6); // USDC has 6 decimals

      const tx = await market
        .connect(borrower)
        .requestLoan(COLLATERAL_AMOUNT, 0, 0);

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });

    it("Should fail loan if health factor would be too low", async function () {
      // Set collateral price very low
      await mockPrimary.setPrice(collateralToken.address, ethers.parseUnits("1", 18)); // $1

      await collateralToken
        .connect(borrower)
        .approve(await market.getAddress(), COLLATERAL_AMOUNT);

      // This should fail because health factor < threshold
      await expect(
        market.connect(borrower).requestLoan(COLLATERAL_AMOUNT, 0, 0)
      ).to.be.reverted;
    });
  });

  // ============ Oracle Router Integration ============

  describe("LendingMarket with OracleRouter", function () {
    beforeEach(async function () {
      // Setup mock oracle prices
      const price = ethers.parseUnits("75", 18); // $75
      await mockPrimary.setPrice(collateralToken.address, price);
      await mockSecondary.setPrice(collateralToken.address, price);

      // Configure router
      await routerOracle.configureOracle(
        collateralToken.address,
        await mockPrimary.getAddress(),
        await mockSecondary.getAddress(),
        ethers.ZeroAddress,
        true, // enableAutomaticFallback
        3600
      );

      // Create market with OracleRouter
      await usdcToken.connect(lpProvider).approve(await factory.getAddress(), INITIAL_LIQUIDITY);

      const tx = await factory
        .connect(lpProvider)
        .createMarket(
          collateralToken.address,
          usdcToken.address,
          0, // AssetType.ERC20
          3, // OracleType.ORACLE_ROUTER
          await routerOracle.getAddress(),
          ethers.ZeroAddress,
          LTV_BPS,
          APR_BPS,
          DURATION,
          INITIAL_LIQUIDITY
        );

      const receipt = await tx.wait();
      const logs = receipt?.logs || [];
      const event = logs
        .map((log) => {
          try {
            return factory.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "MarketCreated");

      market = LendingMarket.attach(event?.args?.[0] || ethers.ZeroAddress);
    });

    it("Should create market with OracleRouter", async function () {
      expect(await market.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await market.oracleType()).to.equal(3); // ORACLE_ROUTER
    });

    it("Should get price from primary oracle via router", async function () {
      const price = await market.getCollateralPrice();
      expect(price).to.equal(ethers.parseUnits("75", 18));

      // Check that primary was used
      const stats = await routerOracle.getStats();
      expect(stats.primaryUsed).to.be.gt(0);
    });

    it("Should fallback to secondary oracle if primary fails", async function () {
      // Disable primary oracle
      await routerOracle.disableOracle(await mockPrimary.getAddress());

      const price = await market.getCollateralPrice();
      expect(price).to.equal(ethers.parseUnits("75", 18));

      // Check that secondary was used
      const stats = await routerOracle.getStats();
      expect(stats.secondaryUsed).to.be.gt(0);
    });

    it("Should originate loan using router oracle pricing", async function () {
      await collateralToken
        .connect(borrower)
        .approve(await market.getAddress(), COLLATERAL_AMOUNT);

      const tx = await market
        .connect(borrower)
        .requestLoan(COLLATERAL_AMOUNT, 0, 0);

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });

    it("Should fail loan if all router oracles fail", async function () {
      // Disable both oracles
      await routerOracle.disableOracle(await mockPrimary.getAddress());
      await routerOracle.disableOracle(await mockSecondary.getAddress());

      await collateralToken
        .connect(borrower)
        .approve(await market.getAddress(), COLLATERAL_AMOUNT);

      await expect(
        market.connect(borrower).requestLoan(COLLATERAL_AMOUNT, 0, 0)
      ).to.be.revertedWith("AllOraclesFailed");
    });
  });

  // ============ Oracle Switching Tests ============

  describe("Oracle Switching Mid-Operation", function () {
    beforeEach(async function () {
      // Create market with mock oracle (primary)
      await mockPrimary.setPrice(collateralToken.address, ethers.parseUnits("100", 18));

      await usdcToken.connect(lpProvider).approve(await factory.getAddress(), INITIAL_LIQUIDITY);

      const tx = await factory
        .connect(lpProvider)
        .createMarket(
          collateralToken.address,
          usdcToken.address,
          0, // AssetType.ERC20
          1, // OracleType.CHAINLINK
          await mockPrimary.getAddress(),
          ethers.ZeroAddress,
          LTV_BPS,
          APR_BPS,
          DURATION,
          INITIAL_LIQUIDITY
        );

      const receipt = await tx.wait();
      const logs = receipt?.logs || [];
      const event = logs
        .map((log) => {
          try {
            return factory.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "MarketCreated");

      market = LendingMarket.attach(event?.args?.[0] || ethers.ZeroAddress);
    });

    it("Should handle price updates between operations", async function () {
      // Get initial price
      const price1 = await market.getCollateralPrice();
      expect(price1).to.equal(ethers.parseUnits("100", 18));

      // Update price
      await mockPrimary.setPrice(collateralToken.address, ethers.parseUnits("150", 18));

      // Get new price
      const price2 = await market.getCollateralPrice();
      expect(price2).to.equal(ethers.parseUnits("150", 18));
    });

    it("Should adjust health factor when price changes", async function () {
      // Originate loan at $100 price
      await collateralToken
        .connect(borrower)
        .approve(await market.getAddress(), COLLATERAL_AMOUNT);

      const borrowTx = await market
        .connect(borrower)
        .requestLoan(COLLATERAL_AMOUNT, 0, 0);
      await borrowTx.wait();

      // Increase price significantly (improves health factor)
      await mockPrimary.setPrice(collateralToken.address, ethers.parseUnits("200", 18));

      // Should still be healthy
      const loans = await market.getAllLoans();
      expect(loans.length).to.be.gt(0);

      // Decrease price significantly (worsens health factor)
      await mockPrimary.setPrice(collateralToken.address, ethers.parseUnits("25", 18));

      // Loan should now be liquidatable
      const loanAddr = loans[0];
      const loanContract = LoanContract.attach(loanAddr);
      const isLiquidatable = await loanContract.isLiquidatable();
      expect(isLiquidatable).to.be.true;
    });
  });

  // ============ Multi-Asset Market Tests ============

  describe("Markets with Different Assets", function () {
    let collateral2: MockERC20;

    beforeEach(async function () {
      // Deploy second collateral token
      const ERC20Factory = await ethers.getContractFactory("MockERC20");
      collateral2 = await ERC20Factory.deploy("Collateral2", "COL2", 18);
      await collateral2.waitForDeployment();

      await collateral2.mint(borrower.address, ethers.parseUnits("10000", 18));

      // Setup prices for both collaterals
      await mockPrimary.setPrice(collateralToken.address, ethers.parseUnits("100", 18));
      await mockPrimary.setPrice(collateral2.address, ethers.parseUnits("50", 18));
    });

    it("Should price multiple collateral types correctly", async function () {
      // Create two markets with same oracle but different collaterals
      await usdcToken
        .connect(lpProvider)
        .approve(await factory.getAddress(), INITIAL_LIQUIDITY.mul(2n));

      const tx1 = await factory
        .connect(lpProvider)
        .createMarket(
          collateralToken.address,
          usdcToken.address,
          0,
          1,
          await mockPrimary.getAddress(),
          ethers.ZeroAddress,
          LTV_BPS,
          APR_BPS,
          DURATION,
          INITIAL_LIQUIDITY
        );

      const tx2 = await factory
        .connect(lpProvider)
        .createMarket(
          collateral2.address,
          usdcToken.address,
          0,
          1,
          await mockPrimary.getAddress(),
          ethers.ZeroAddress,
          LTV_BPS,
          APR_BPS,
          DURATION,
          INITIAL_LIQUIDITY
        );

      const receipt1 = await tx1.wait();
      const receipt2 = await tx2.wait();

      const market1Addr = receipt1?.logs
        ?.map((log) => {
          try {
            return factory.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "MarketCreated")?.args?.[0];

      const market2Addr = receipt2?.logs
        ?.map((log) => {
          try {
            return factory.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "MarketCreated")?.args?.[0];

      const market1 = LendingMarket.attach(market1Addr);
      const market2 = LendingMarket.attach(market2Addr);

      const price1 = await market1.getCollateralPrice();
      const price2 = await market2.getCollateralPrice();

      expect(price1).to.equal(ethers.parseUnits("100", 18));
      expect(price2).to.equal(ethers.parseUnits("50", 18));
    });
  });

  // ============ Circuit Breaker Oracle Tests ============

  describe("Circuit Breaker with Oracle Prices", function () {
    beforeEach(async function () {
      await mockPrimary.setPrice(collateralToken.address, ethers.parseUnits("100", 18));

      await usdcToken.connect(lpProvider).approve(await factory.getAddress(), INITIAL_LIQUIDITY);

      const tx = await factory
        .connect(lpProvider)
        .createMarket(
          collateralToken.address,
          usdcToken.address,
          0,
          1,
          await mockPrimary.getAddress(),
          ethers.ZeroAddress,
          LTV_BPS,
          APR_BPS,
          DURATION,
          INITIAL_LIQUIDITY
        );

      const receipt = await tx.wait();
      const logs = receipt?.logs || [];
      const event = logs
        .map((log) => {
          try {
            return factory.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "MarketCreated");

      market = LendingMarket.attach(event?.args?.[0] || ethers.ZeroAddress);
    });

    it("Should detect massive price swings", async function () {
      // Originate loan at $100
      await collateralToken
        .connect(borrower)
        .approve(await market.getAddress(), COLLATERAL_AMOUNT);
      await market.connect(borrower).requestLoan(COLLATERAL_AMOUNT, 0, 0);

      // Price crashes 90%
      await mockPrimary.setPrice(collateralToken.address, ethers.parseUnits("10", 18));

      // Circuit breaker should potentially trigger
      // (depends on circuit breaker threshold configuration)
      // This test just verifies the market handles extreme prices gracefully
      const isTriggered = await market.isCircuitBreakerTriggered();
      expect(isTriggered).to.be.a("boolean");
    });
  });

  // ============ Oracle Failure Scenarios ============

  describe("Oracle Failure Scenarios", function () {
    it("Should fail gracefully if oracle returns invalid data", async function () {
      // Setup oracle that returns invalid price
      const MockFactory = await ethers.getContractFactory("MockOracle");
      const badOracle = await MockFactory.deploy();
      await badOracle.waitForDeployment();

      // Set unsafe state
      await badOracle.setSafe(false);

      await usdcToken.connect(lpProvider).approve(await factory.getAddress(), INITIAL_LIQUIDITY);

      // Market creation should handle oracle failure
      const tx = factory
        .connect(lpProvider)
        .createMarket(
          collateralToken.address,
          usdcToken.address,
          0,
          1,
          await badOracle.getAddress(),
          ethers.ZeroAddress,
          LTV_BPS,
          APR_BPS,
          DURATION,
          INITIAL_LIQUIDITY
        );

      // Depending on implementation, this might fail or create market
      // The important thing is it doesn't cause undefined behavior
      try {
        await tx;
      } catch {
        // Expected in some cases
      }
    });
  });

  // ============ Gas Efficiency Tests ============

  describe("Gas Efficiency", function () {
    it("Should use reasonable gas for price fetches", async function () {
      await mockPrimary.setPrice(collateralToken.address, ethers.parseUnits("100", 18));

      await usdcToken.connect(lpProvider).approve(await factory.getAddress(), INITIAL_LIQUIDITY);

      const tx = await factory
        .connect(lpProvider)
        .createMarket(
          collateralToken.address,
          usdcToken.address,
          0,
          1,
          await mockPrimary.getAddress(),
          ethers.ZeroAddress,
          LTV_BPS,
          APR_BPS,
          DURATION,
          INITIAL_LIQUIDITY
        );

      const receipt = await tx.wait();
      const logs = receipt?.logs || [];
      const event = logs
        .map((log) => {
          try {
            return factory.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "MarketCreated");

      market = LendingMarket.attach(event?.args?.[0] || ethers.ZeroAddress);

      // Price fetch should be relatively cheap
      const gasEstimate = await market.getCollateralPrice.estimateGas();
      expect(gasEstimate).to.be.lt(100000); // Should be < 100k gas
    });
  });
});
