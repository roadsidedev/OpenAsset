/**
 * @file verifyV2.ts
 * @description On-chain verification of the updated V2 contracts on baseSepolia.
 *
 * Verifies:
 *  1. All adapters are registered + selectable in the registry
 *  2. USDC is allowlisted as a lending asset
 *  3. Position adapters are wired to the factory (multi-tenant fix)
 *  4. createMarket REVERTS with "Collateral must be a contract" for a non-contract
 *     collateral (the root cause of the incident fix)
 *  5. A real end-to-end market creation succeeds (collateral approve + registerMarket +
 *     liquidity init + MarketCreated event)
 *
 * Usage:
 *   npx hardhat run scripts/verifyV2.ts --network baseSepolia
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/** Send a tx and wait, retrying on transient RPC errors (timeouts, replacement underpriced). */
async function sendAndWait(label: string, send: () => Promise<any>): Promise<any> {
  for (let i = 1; ; i++) {
    try {
      const tx = await send();
      return await tx.wait();
    } catch (e: any) {
      const msg = String(e?.code ?? e?.message ?? e).slice(0, 80);
      if (i >= 6 || !/UND_ERR|ETIMEDOUT|ECONNRESET|Timeout|timeout|underpriced|nonce too low|already known/i.test(msg)) {
        throw e;
      }
      console.log(`    [retry ${i}] ${label} (${msg})`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

/** Read-only RPC call with retry on transient connection errors. */
async function retryRead<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = (e?.code || e?.message || String(e)).slice(0, 80);
      if (i >= 8 || !/UND_ERR|ETIMEDOUT|ECONNRESET|Timeout|timeout|BAD_DATA|could not decode|empty data/i.test(msg)) {
        throw e;
      }
      console.log(`    [retry ${i}] ${label} (${msg})`);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

async function main() {
  const networkName = network.name;
  const deploymentPath = path.join(__dirname, "..", "deployments", `${networkName}-v2.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment file found at ${deploymentPath}. Deploy first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const d = deployment.contracts;
  const [deployer] = await ethers.getSigners();

  // For post-transaction on-chain reads, use a fresh RPC provider instead of the
  // in-process hardhat node, which can return stale state immediately after wait().
  const rpcUrl =
    process.env.BASE_SEPOLIA_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    "https://sepolia.base.org";
  const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);

  // Lending asset used for the allowlist check — differs per network
  const USDC =
    network.name === "baseSepolia"
      ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
      : network.name === "sepolia"
        ? "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
        : network.name === "robinhoodTestnet"
          ? process.env.ROBINHOOD_USDC_ADDRESS || "0xA58C61370e0f7c419379ac7C27554E1e4de3e940"
          : "0x0000000000000000000000000000000000000000";

  console.log(`\n=== Verifying deployment on ${networkName} ===`);
  console.log(`Factory:     ${d.marketFactory}`);
  console.log(`Registry:    ${d.adapterRegistry}`);
  console.log(`Deployer:    ${deployer.address}`);

  const factory = await ethers.getContractAt("MarketFactoryV2", d.marketFactory);
  const registry = await ethers.getContractAt("AdapterRegistry", d.adapterRegistry);

  const results: Array<[string, boolean]> = [];

  // 1. Adapter selectability
  const adapters = {
    erc20Adapter: d.erc20Adapter,
    erc721Adapter: d.erc721Adapter,
    chainlinkAdapter: d.chainlinkAdapter,
    uniswapV3TWAPAdapter: d.uniswapV3TWAPAdapter,
    standardPosition: d.standardPosition,
    soulboundPosition: d.soulboundPosition,
    transferablePosition: d.transferablePosition,
    dexSwapLiquidation: d.dexSwapLiquidation,
    nftAuctionLiquidation: d.nftAuctionLiquidation,
  };
  console.log("\n--- 1. Adapter selectability ---");
  for (const [name, addr] of Object.entries(adapters)) {
    const sel = await retryRead(`isSelectable(${name})`, () => registry.isSelectable(addr));
    results.push([`isSelectable(${name})`, sel]);
    console.log(`  ${sel ? "✓" : "✗"} ${name}: ${sel ? "selectable" : "NOT SELECTABLE"}`);
  }

  // 2. Lending asset allowlist
  console.log("\n--- 2. Lending asset allowlist ---");
  const usdcAllowed = await retryRead("isAllowedLendingAsset(USDC)", () => factory.isAllowedLendingAsset(USDC));
  results.push(["isAllowedLendingAsset(USDC)", usdcAllowed]);
  console.log(`  ${usdcAllowed ? "✓" : "✗"} USDC allowlisted: ${usdcAllowed}`);

  // 3. Position adapter templates carry the initializer-lock sentinel (clone pattern
  // + review M8: templates must be _disableInitializers-locked, never wired to a factory)
  console.log("\n--- 3. Position adapter template sentinel + clone wiring ---");
  const FACTORY_SENTINEL = "0x000000000000000000000000000000000000dead";
  for (const name of ["standardPosition", "soulboundPosition", "transferablePosition"]) {
    const pos = await ethers.getContractAt("StandardPositionAdapter", d[name]);
    const posFactory = await retryRead(`${name}.factory()`, () => pos.factory());
    const ok = posFactory.toLowerCase() === FACTORY_SENTINEL;
    results.push([`${name} template factory() == sentinel (unwired)`, ok]);
    console.log(`  ${ok ? "✓" : "✗"} ${name}.factory() = ${posFactory} (${ok ? "sentinel — template locked" : "MISMATCH"})`);
  }

  // 4. Revert test: non-contract collateral
  console.log("\n--- 4. Revert on non-contract collateral (root-cause fix) ---");
  const badConfig = {
    lpAddress: deployer.address,
    collateralAsset: deployer.address, // EOA — not a contract
    assetAdapter: d.erc20Adapter,
    oracleAdapter: d.uniswapV3TWAPAdapter,
    complianceAdapter: ethers.ZeroAddress,
    liquidationAdapter: d.dexSwapLiquidation,
    positionAdapter: d.standardPosition,
    lendingAsset: USDC,
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

  let revertedCorrectly = false;
  try {
    await factory.connect(deployer).createMarket.staticCall(badConfig, 1_000_000);
    console.log("  ✗ DID NOT revert — expected 'Collateral must be a contract'");
  } catch (e: any) {
    const msg = e?.reason || e?.message || String(e);
    revertedCorrectly = msg.toLowerCase().includes("collateral must be a contract");
    console.log(`  ${revertedCorrectly ? "✓" : "✗"} Reverted: "${msg}"`);
  }
  results.push(["revert on non-contract collateral", revertedCorrectly]);

  // 5. End-to-end market creation
  console.log("\n--- 5. End-to-end market creation ---");

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const collateral = await MockERC20.deploy("Mock Collateral", "MCOL", 18);
  await collateral.waitForDeployment();
  const lending = await MockERC20.deploy("Mock Lending", "MLND", 6);
  await lending.waitForDeployment();
  console.log(`  Collateral: ${await collateral.getAddress()}`);
  console.log(`  Lending:    ${await lending.getAddress()}`);

  const lendingAddress = await lending.getAddress();
  const factoryAddress = await factory.getAddress();

  // Allowlist the mock lending asset
  await sendAndWait("addLendingAsset(mock)", () => factory.connect(deployer).addLendingAsset(lendingAddress));
  console.log("  ✓ Allowlisted mock lending asset");

  // Fund the deployer
  const LIQ = ethers.parseUnits("1000000", 6); // 1,000,000 lending units
  await sendAndWait("mint(lending)", () => lending.mint(deployer.address, LIQ));
  await sendAndWait("approve(lending)", () => lending.connect(deployer).approve(factoryAddress, LIQ));
  console.log("  ✓ Minted + approved lending asset");

  const config = {
    lpAddress: deployer.address,
    collateralAsset: await collateral.getAddress(),
    assetAdapter: d.erc20Adapter,
    oracleAdapter: d.uniswapV3TWAPAdapter,
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

  const initialLiquidity = ethers.parseUnits("1000", 6); // 1000 lending units

  const beforeCount = await retryRead("getMarketCount", () => factory.getMarketCount());
  const createReceipt = await sendAndWait("createMarket", () =>
    factory.connect(deployer).createMarket(config, initialLiquidity)
  );
  const receipt = createReceipt;

  // The auto-mined state can lag the returned receipt; confirm via the receipt status
  // and the emitted MarketCreated event, then re-read state once mined.
  const txStatusOk = receipt.status === 1;
  results.push(["createMarket tx status == success (1)", txStatusOk]);
  console.log(`  ${txStatusOk ? "✓" : "✗"} Tx status: ${receipt.status}`);

  let marketAddress: string | null = null;
  let marketCreatedEvent = false;
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed?.name === "MarketCreated") {
        marketCreatedEvent = true;
        marketAddress = parsed.args.marketAddress;
        console.log(`  Market created at: ${marketAddress}`);
      }
    } catch {
      // ignore non-factory logs
    }
  }
  results.push(["MarketCreated event emitted", marketCreatedEvent]);
  console.log(`  ${marketCreatedEvent ? "✓" : "✗"} MarketCreated event: ${marketCreatedEvent}`);

  if (marketCreatedEvent && marketAddress) {
    // RPC nodes can lag on post-tx state (RH testnet lags minutes). Poll at latest
    // with a generous budget instead of pinning the receipt block.
    const factoryOnChain = new ethers.Contract(d.marketFactory, factory.interface, rpcProvider);

    let isRegistered = false;
    let code = "0x";
    for (let i = 0; i < 60 && !(isRegistered && code.length > 2); i++) {
      try {
        isRegistered = await factoryOnChain.isMarket(marketAddress);
        code = await rpcProvider.getCode(marketAddress);
      } catch {
        // retry
      }
      if (!(isRegistered && code.length > 2)) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    results.push(["isMarket(marketAddress) == true", isRegistered]);
    console.log(`  ${isRegistered ? "✓" : "✗"} isMarket: ${isRegistered}`);

    const hasCode = code.length > 2;
    results.push(["market is a deployed contract", hasCode]);
    console.log(`  ${hasCode ? "✓" : "✗"} Market bytecode length: ${code.length}`);

    let count = beforeCount;
    let countRead = false;
    for (let i = 0; i < 8 && !countRead; i++) {
      try {
        count = await factoryOnChain.getMarketCount();
        countRead = true;
      } catch {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    if (!countRead) throw new Error("getMarketCount unreadable after retries (flaky RPC)");
    const countOk = count > beforeCount;
    results.push(["getMarketCount increased", countOk]);
    console.log(`  ${countOk ? "✓" : "✗"} Market count: ${beforeCount} → ${count}`);

    // Clone wiring: the e2e market's position adapter must be a clone whose
    // factory() points at the real factory (proves the M6 registration path works)
    try {
      const marketOnChain = new ethers.Contract(marketAddress, ["function positionAdapter() view returns (address)"], rpcProvider);
      const clonePosAddr = await marketOnChain.positionAdapter();
      const clonePos = new ethers.Contract(clonePosAddr, ["function factory() view returns (address)"], rpcProvider);
      const cloneFactory = await clonePos.factory();
      const cloneOk = cloneFactory.toLowerCase() === d.marketFactory.toLowerCase();
      results.push(["e2e market position-adapter clone factory() == MarketFactory", cloneOk]);
      console.log(`  ${cloneOk ? "✓" : "✗"} clone factory: ${cloneFactory}`);
    } catch (e: any) {
      results.push(["e2e market position-adapter clone factory() == MarketFactory", false]);
      console.log(`  ✗ clone factory check failed: ${(e?.message || String(e)).slice(0, 100)}`);
    }
  }

  // ---- Summary ----
  console.log("\n========================================");
  console.log("VERIFICATION SUMMARY");
  console.log("========================================");
  const failed = results.filter(([, ok]) => !ok);
  for (const [name, ok] of results) {
    console.log(`  ${ok ? "✓" : "✗"} ${name}`);
  }
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
