/**
 * @file verifyV2Chainlink.ts
 * @description On-chain verification of the ChainlinkAdapter feed configuration + pricing.
 *
 * Verifies:
 *  1. Feeds are registered for supported collateral assets (WETH -> ETH/USD, USDC -> USDC/USD)
 *  2. A market using ChainlinkAdapter as the oracle returns a TRUSTED, real price
 *  3. A market whose collateral has no registered feed returns UNTRUSTED (fail-safe)
 *
 * Usage:
 *   npx hardhat run scripts/verifyV2Chainlink.ts --network baseSepolia
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}-v2.json`);
  if (!fs.existsSync(deploymentPath)) throw new Error(`No deployment file at ${deploymentPath}`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const d = deployment.contracts;
  const [deployer] = await ethers.getSigners();

  const WETH = "0x4200000000000000000000000000000000000006";
  const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const ETH_USD_FEED = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1";
  const USDC_USD_FEED = "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165";

  const factory = await ethers.getContractAt("MarketFactoryV2", d.marketFactory);
  const chainlink = await ethers.getContractAt("ChainlinkAdapter", d.chainlinkAdapter);

  console.log(`\n=== Verifying ChainlinkAdapter pricing on ${network.name} ===`);
  console.log(`ChainlinkAdapter: ${d.chainlinkAdapter}`);

  const results: Array<[string, boolean]> = [];

  // 1. Feed registration
  console.log("\n--- 1. Feed registration ---");
  const wethCfg = await chainlink.assetFeeds(WETH);
  const usdcCfg = await chainlink.assetFeeds(USDC);
  const wethFeedOk = wethCfg.feed.toLowerCase() === ETH_USD_FEED.toLowerCase();
  const usdcFeedOk = usdcCfg.feed.toLowerCase() === USDC_USD_FEED.toLowerCase();
  results.push(["WETH -> ETH/USD feed registered", wethFeedOk]);
  results.push(["USDC -> USDC/USD feed registered", usdcFeedOk]);
  console.log(`  ${wethFeedOk ? "✓" : "✗"} WETH feed: ${wethCfg.feed} (staleness ${wethCfg.maxStaleness})`);
  console.log(`  ${usdcFeedOk ? "✓" : "✗"} USDC feed: ${usdcCfg.feed} (staleness ${usdcCfg.maxStaleness})`);
  console.log(`  ${usdcCfg.maxStaleness === 86400n ? "✓" : "✗"} USDC staleness == 86400`);

  // 2. Create a market with WETH collateral + ChainlinkAdapter oracle
  console.log("\n--- 2. Market with Chainlink oracle (WETH collateral) ---");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const lending = await MockERC20.deploy("Mock Lending", "MLND", 6);
  await lending.waitForDeployment();
  await factory.connect(deployer).addLendingAsset(await lending.getAddress());
  const LIQ = ethers.parseUnits("100000", 6);
  await lending.mint(deployer.address, LIQ);
  await lending.connect(deployer).approve(await factory.getAddress(), LIQ);

  const config = {
    lpAddress: deployer.address,
    collateralAsset: WETH,
    assetAdapter: d.erc20Adapter,
    oracleAdapter: d.chainlinkAdapter,
    complianceAdapter: ethers.ZeroAddress,
    liquidationAdapter: d.dexSwapLiquidation,
    positionAdapter: d.standardPosition,
    lendingAsset: await lending.getAddress(),
    ltvBasisPoints: 7000,
    aprBasisPoints: 1200,
    durationSeconds: 30 * 24 * 60 * 60,
    gracePeriodHours: 24,
    enableHealthFactor: true,
    healthFactorThreshold: 12000,
    enableCircuitBreaker: true,
    pauseThresholdBps: 2000,
    lookbackPeriodSeconds: 3600,
    resumeThresholdBps: 1000,
    cooldownSeconds: 7200,
  };

  const createTx = await factory.connect(deployer).createMarket(config, ethers.parseUnits("1000", 6));
  const receipt = await createTx.wait();
  const txOk = receipt.status === 1;
  results.push(["createMarket (Chainlink oracle) succeeded", txOk]);
  console.log(`  ${txOk ? "✓" : "✗"} Tx status: ${receipt.status}`);

  let marketAddress: string | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed?.name === "MarketCreated") marketAddress = parsed.args.marketAddress;
    } catch { /* ignore */ }
  }
  console.log(`  Market: ${marketAddress}`);
  results.push(["MarketCreated emitted", marketAddress !== null]);

  // 3. getPrice from the market should be trusted (real ETH/USD price)
  console.log("\n--- 3. getPrice trusted (WETH collateral) ---");
  let trusted = false;
  let price = 0n;
  if (marketAddress) {
    const raw = await ethers.provider.call({
      from: marketAddress,
      to: d.chainlinkAdapter,
      data: chainlink.interface.encodeFunctionData("getPrice"),
    });
    const decoded = chainlink.interface.decodeFunctionResult("getPrice", raw);
    price = decoded.price;
    trusted = decoded.isTrusted;
    const usd = Number(price) / 1e18;
    console.log(`  ${trusted ? "✓" : "✗"} isTrusted: ${trusted} | price: $${usd.toFixed(2)}`);
    results.push(["getPrice trusted for WETH market", trusted]);
    results.push(["price is sane (100 < usd < 100000)", usd > 100 && usd < 100000]);
  } else {
    results.push(["getPrice trusted for WETH market", false]);
  }

  // 4. getPrice for a market with NO feed must be untrusted (fail-safe)
  console.log("\n--- 4. getPrice untrusted (unregistered collateral) ---");
  const bogusMarket = ethers.Wallet.createRandom().address;
  const raw2 = await ethers.provider.call({
    from: bogusMarket,
    to: d.chainlinkAdapter,
    data: chainlink.interface.encodeFunctionData("getPrice"),
  });
  const decoded2 = chainlink.interface.decodeFunctionResult("getPrice", raw2);
  const untrusted = !decoded2.isTrusted;
  results.push(["getPrice untrusted for unregistered collateral", untrusted]);
  console.log(`  ${untrusted ? "✓" : "✗"} isTrusted: ${decoded2.isTrusted} (expected false)`);

  // ---- Summary ----
  console.log("\n========================================");
  console.log("CHAINLINK VERIFICATION SUMMARY");
  console.log("========================================");
  const failed = results.filter(([, ok]) => !ok);
  for (const [name, ok] of results) console.log(`  ${ok ? "✓" : "✗"} ${name}`);
  console.log("========================================");
  if (failed.length > 0) {
    console.log(`${failed.length} check(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log(`All ${results.length} checks PASSED`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
