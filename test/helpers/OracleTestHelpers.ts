import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ChainlinkOracle, OracleRouter, MockOracle } from "../typechain-types";

/**
 * @title Oracle Test Helpers
 * @notice Utilities and fixtures for oracle testing
 */

export interface OracleTestSetup {
  owner: SignerWithAddress;
  user: SignerWithAddress;
  chainlinkOracle: ChainlinkOracle;
  routerOracle: OracleRouter;
  mockPrimary: MockOracle;
  mockSecondary: MockOracle;
  mockTertiary: MockOracle;
}

/**
 * Deploy all oracle contracts for testing
 */
export async function deployAllOracles(owner: SignerWithAddress): Promise<OracleTestSetup> {
  const [deployer, user] = await ethers.getSigners();

  // Deploy ChainlinkOracle
  const ChainlinkFactory = await ethers.getContractFactory("ChainlinkOracle");
  const chainlinkOracle = await ChainlinkFactory.deploy(owner.address);
  await chainlinkOracle.waitForDeployment();

  // Deploy OracleRouter
  const RouterFactory = await ethers.getContractFactory("OracleRouter");
  const routerOracle = await RouterFactory.deploy(owner.address);
  await routerOracle.waitForDeployment();

  // Deploy mock oracles
  const MockFactory = await ethers.getContractFactory("MockOracle");
  const mockPrimary = await MockFactory.deploy();
  await mockPrimary.waitForDeployment();

  const mockSecondary = await MockFactory.deploy();
  await mockSecondary.waitForDeployment();

  const mockTertiary = await MockFactory.deploy();
  await mockTertiary.waitForDeployment();

  return {
    owner,
    user,
    chainlinkOracle,
    routerOracle,
    mockPrimary,
    mockSecondary,
    mockTertiary,
  };
}

/**
 * Configure router with all three oracle tiers
 */
export async function configureRouterWithFallbacks(
  router: OracleRouter,
  asset: string,
  primaryOracle: string,
  secondaryOracle: string,
  tertiaryOracle: string,
  maxPriceAge: number = 3600
): Promise<void> {
  await router.configureOracle(
    asset,
    primaryOracle,
    secondaryOracle,
    tertiaryOracle,
    true, // enableAutomaticFallback
    maxPriceAge
  );
}

/**
 * Set up common test prices
 */
export async function setPricesForAssets(
  oracle: MockOracle,
  assets: string[],
  prices: bigint[]
): Promise<void> {
  if (assets.length !== prices.length) {
    throw new Error("Assets and prices arrays must have same length");
  }

  for (let i = 0; i < assets.length; i++) {
    await oracle.setPrice(assets[i], prices[i]);
  }
}

/**
 * Simulate oracle failure by disabling
 */
export async function simulateOracleFailure(
  router: OracleRouter,
  oracle: string
): Promise<void> {
  await router.disableOracle(oracle);
}

/**
 * Simulate oracle recovery
 */
export async function simulateOracleRecovery(
  router: OracleRouter,
  oracle: string
): Promise<void> {
  await router.enableOracle(oracle);
}

/**
 * Get routing statistics
 */
export async function getRouterStats(router: OracleRouter): Promise<{
  primaryUsed: bigint;
  secondaryUsed: bigint;
  tertiaryUsed: bigint;
  failures: bigint;
  totalRequests: bigint;
}> {
  return await router.getStats();
}

/**
 * Test all oracles in router
 */
export async function testAllOraclesInRouter(
  router: OracleRouter,
  asset: string
): Promise<{
  primaryWorks: boolean;
  primaryPrice: bigint;
  secondaryWorks: boolean;
  secondaryPrice: bigint;
  tertiaryWorks: boolean;
  tertiaryPrice: bigint;
}> {
  return await router.testOracles(asset);
}

/**
 * Common test assets for unit tests
 */
export const TEST_ASSETS = {
  USDC: ethers.getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  DAI: ethers.getAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F"),
  USDT: ethers.getAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7"),
  WETH: ethers.getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
};

/**
 * Common test prices (18 decimals)
 */
export const TEST_PRICES = {
  STABLECOIN_1USD: ethers.parseUnits("1", 18),
  TOKEN_100USD: ethers.parseUnits("100", 18),
  TOKEN_1000USD: ethers.parseUnits("1000", 18),
  LOW_PRICE_0_01USD: ethers.parseUnits("0.01", 18),
  HIGH_PRICE_10000USD: ethers.parseUnits("10000", 18),
};

/**
 * Wait for oracle to be properly configured
 */
export async function waitForOracleConfiguration(
  oracle: ChainlinkOracle | OracleRouter,
  asset: string,
  maxAttempts: number = 10
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await oracle.supportsAsset(asset)) {
      return true;
    }
    await ethers.provider.send("evm_mine", []);
  }
  return false;
}

/**
 * Verify oracle price range
 */
export async function verifyPriceInRange(
  price: bigint,
  minPrice: bigint,
  maxPrice: bigint
): Promise<boolean> {
  return price >= minPrice && price <= maxPrice;
}

/**
 * Calculate expected loan amount from collateral
 */
export function calculateExpectedLoanAmount(
  collateralAmount: bigint,
  collateralPrice: bigint,
  ltv: number, // basis points
  decimalsAdjustment: number = 0
): bigint {
  // (collateralAmount * collateralPrice * ltv) / (1e18 * 10000)
  const numerator = collateralAmount * collateralPrice * BigInt(ltv);
  const denominator = BigInt(1e18) * BigInt(10000);
  return numerator / denominator;
}

/**
 * Calculate health factor
 */
export function calculateHealthFactor(
  collateralValue: bigint,
  loanAmount: bigint,
  ltv: number
): bigint {
  // healthFactor = (collateralValue / loanAmount) * 1e18
  if (loanAmount === 0n) return BigInt("999999999999999999999"); // Very high if no loan
  return (collateralValue * BigInt(1e18)) / loanAmount;
}

/**
 * Check if health factor is healthy
 */
export function isHealthFactorHealthy(
  healthFactor: bigint,
  thresholdBps: number = 12000 // 120%
): boolean {
  return healthFactor >= BigInt(thresholdBps * 1e15); // Convert BPS to 18 decimals
}

/**
 * Simulate price volatility
 */
export async function simulatePriceVolatility(
  oracle: MockOracle,
  asset: string,
  priceChanges: number[] // Percentage changes, e.g., [10, -20, 5] = +10%, -20%, +5%
): Promise<bigint[]> {
  let currentPrice = (await oracle.prices(asset)) || ethers.parseUnits("100", 18);
  const prices: bigint[] = [currentPrice];

  for (const change of priceChanges) {
    const changeAmount = (currentPrice * BigInt(change)) / BigInt(100);
    currentPrice = currentPrice + changeAmount;
    await oracle.setPrice(asset, currentPrice);
    prices.push(currentPrice);
  }

  return prices;
}

/**
 * Format price for display
 */
export function formatPrice(price: bigint, decimals: number = 18): string {
  return ethers.formatUnits(price, decimals);
}

/**
 * Parse price from string
 */
export function parsePrice(price: string, decimals: number = 18): bigint {
  return ethers.parseUnits(price, decimals);
}

/**
 * Generate random oracle prices for stress testing
 */
export function generateRandomPrices(count: number, minUSD: number = 0.01, maxUSD: number = 100000): bigint[] {
  const prices: bigint[] = [];
  for (let i = 0; i < count; i++) {
    const randomPrice = Math.random() * (maxUSD - minUSD) + minUSD;
    prices.push(ethers.parseUnits(randomPrice.toString(), 18));
  }
  return prices;
}

/**
 * Test oracle price consistency
 */
export async function testPriceConsistency(
  oracle: ChainlinkOracle | OracleRouter,
  asset: string,
  expectedPrice: bigint,
  tolerance: number = 100 // basis points (1% = 100 bps)
): Promise<boolean> {
  const [price] = await oracle.getPrice(asset);
  const diff = price > expectedPrice ? price - expectedPrice : expectedPrice - price;
  const toleranceAmount = (expectedPrice * BigInt(tolerance)) / BigInt(10000);
  return diff <= toleranceAmount;
}
