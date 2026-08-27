import { ethers } from "hardhat";

const ADDRESSES = {
  factory: "0x331b95CAA15Bf23645A28059937B6D5cb0cA74BB",
  configurator: "0x2296a019079BA10E4430DC8012504d92B5B8A795",
  aapl: "0xAf6D6d1F38d50d5C5C8219Be2938774a64E1f948",
  usdg: "0xA58C61370e0f7c419379ac7C27554E1e4de3e940",
  feed: "0x43a7feb2cfa522000228374cad606b5673C4dAF1",
  sequencer: "0xD32cEF08EC661ceB8785231cB968F60aE7C29F55",
  erc20Adapter: "0xbF55804fE683da2eA401aFe2b2E6d9f55a1f1AaD",
  equityFeed: "0xAEf469a4ab0c51D6fa5b5Fd1368d2e3b85ecC602",
  compliance: "0x95599a74Ae215d8208f7Bb6A8e680B0C58F03c67",
  liquidation: "0x4bd273BE748073B38A5F4D2415be54C28c754598",
  position: "0xA34C6BC828789ee963B492b9AC68675DA0E1252B",
};

const APR_BPS = 1200n;
const BPS = 10000n;
const YEAR = 365n * 24n * 60n * 60n;

function expectedInterest(principal: bigint, elapsed: bigint): bigint {
  const annual = (principal * APR_BPS) / BPS;
  return (annual * elapsed) / YEAR;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  if (net.chainId !== 46630n) {
    throw new Error(`Expected robinhoodTestnet 46630, got ${net.chainId}`);
  }
  console.log(`Deployer ${signer.address}  chain ${net.chainId}`);
  console.log(`ETH ${ethers.formatEther(await ethers.provider.getBalance(signer.address))}`);

  const factory = await ethers.getContractAt("MarketFactoryV2", ADDRESSES.factory);
  const usdg = await ethers.getContractAt("MockERC20", ADDRESSES.usdg);
  const aapl = await ethers.getContractAt("MockRobinhoodToken", ADDRESSES.aapl);
  const sequencer = await ethers.getContractAt("MockChainlinkFeed", ADDRESSES.sequencer);
  const feed = await ethers.getContractAt("MockChainlinkFeed", ADDRESSES.feed);
  const compliance = await ethers.getContractAt("ManagedAllowlistComplianceAdapter", ADDRESSES.compliance);
  const providerId = ethers.keccak256(ethers.toUtf8Bytes("OPENASSET_PROVIDER_ROBINHOOD"));

  const latest = await ethers.provider.getBlock("latest");
  const now = BigInt(latest!.timestamp);
  await (await sequencer.setAnswer(0)).wait();
  await (await sequencer.setStartedAt(now - 7200n)).wait();
  await (await feed.setAnswer(31152209667n)).wait();
  console.log("Refreshed mock sequencer (answer=0, startedAt=now-2h) and AAPL feed");

  const currentConfigurator = await factory.providerConfigurators(providerId);
  if (currentConfigurator.toLowerCase() !== ADDRESSES.configurator.toLowerCase()) {
    await (await factory.setProviderConfigurator(providerId, ADDRESSES.configurator)).wait();
    console.log("setProviderConfigurator");
  } else {
    console.log("configurator already set");
  }
  if (!(await factory.isProviderAsset(providerId, ADDRESSES.aapl))) {
    await (await factory.setProviderAsset(providerId, ADDRESSES.aapl, true)).wait();
    console.log("setProviderAsset AAPL");
  } else {
    console.log("AAPL already reserved");
  }

  let market: string;
  const existing = await factory.getAssetMarkets(ADDRESSES.aapl);
  if (existing.length > 0) {
    market = existing[0];
    console.log(`Reusing market ${market}`);
  } else {
    const liquidity = ethers.parseUnits("1000", 6);
    await (await usdg.approve(ADDRESSES.factory, liquidity)).wait();
    const config = {
      lpAddress: signer.address,
      collateralAsset: ADDRESSES.aapl,
      assetAdapter: ADDRESSES.erc20Adapter,
      oracleAdapter: ADDRESSES.equityFeed,
      complianceAdapter: ADDRESSES.compliance,
      liquidationAdapter: ADDRESSES.liquidation,
      positionAdapter: ADDRESSES.position,
      lendingAsset: ADDRESSES.usdg,
      ltvBasisPoints: 5000,
      aprBasisPoints: Number(APR_BPS),
      durationSeconds: 30 * 24 * 60 * 60,
      gracePeriodHours: 24,
      enableHealthFactor: true,
      healthFactorThreshold: 11000,
      enableCircuitBreaker: false,
      pauseThresholdBps: 0,
      lookbackPeriodSeconds: 0,
      resumeThresholdBps: 0,
      cooldownSeconds: 0,
    };
    const providerConfig = {
      providerId,
      providerData: ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "address"],
        [ADDRESSES.feed, 86400, ADDRESSES.sequencer],
      ),
    };
    const tx = await factory.createProviderMarket(config, liquidity, providerConfig);
    const receipt = await tx.wait();
    market = (await factory.getAllMarkets()).at(-1)!;
    console.log(`Created market ${market} tx=${receipt?.hash}`);
  }

  const lendingMarket = await ethers.getContractAt("LendingMarketV2", market);
  console.log(`aprBps=${await lendingMarket.aprBps()} duration=${await lendingMarket.durationSeconds()}`);

  if (!(await compliance.eligible(market, signer.address))) {
    await (await compliance.setEligibility(market, signer.address, true)).wait();
    console.log("allowlisted deployer");
  }

  const collateral = ethers.parseEther("1");
  const principal = ethers.parseUnits("100", 6);
  if ((await aapl.balanceOf(signer.address)) < collateral) {
    await (await aapl.mint(signer.address, collateral)).wait();
  }
  await (await aapl.approve(ADDRESSES.erc20Adapter, collateral)).wait();

  const loanTx = await lendingMarket["requestLoan(uint256,uint256)"](collateral, principal);
  const loanReceipt = await loanTx.wait();
  const loanId = (await lendingMarket.nextLoanId()) - 1n;
  console.log(`Loan ${loanId} created tx=${loanReceipt?.hash}`);

  const details = await lendingMarket.getLoanDetails(loanId);
  const blockAfter = await ethers.provider.getBlock("latest");
  const elapsed = BigInt(blockAfter!.timestamp) - details.startTime;
  const timeBased = expectedInterest(details.principal, elapsed);
  const oldFixed = (details.principal * APR_BPS) / BPS;
  console.log(`principal=${ethers.formatUnits(details.principal, 6)} USDG`);
  console.log(`elapsed=${elapsed}s  timeBasedInterest=${timeBased}  oldFixedInterest=${oldFixed}`);
  console.log(`healthFactor=${details.healthFactor}`);

  if (timeBased >= oldFixed) {
    throw new Error("APR proof failed: time-based interest is not strictly less than old fixed 12%");
  }
  if (elapsed === 0n && timeBased !== 0n) {
    throw new Error("APR proof failed: same-block interest must be 0");
  }
  console.log("PASS: same-block / short-elapsed interest is pro-rata, not full annual APR");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
