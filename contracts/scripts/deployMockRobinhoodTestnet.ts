import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  // 1. Mock USDG (6 decimals)
  console.log("\n=== Deploying Mock USDG (6 decimals) ===");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdg = await MockERC20.deploy("Mock USDG", "USDG", 6);
  await usdg.waitForDeployment();
  const usdgAddr = await usdg.getAddress();
  console.log(`Mock USDG: ${usdgAddr}`);
  // mint some to deployer
  await (await usdg.mint(deployer.address, ethers.parseUnits("100000", 6))).wait();
  console.log(`  minted 100k USDG to deployer`);

  // 2. Mock AAPL Robinhood token (18 decimals)
  console.log("\n=== Deploying Mock AAPL (Robinhood) ===");
  const MockRobinhoodToken = await ethers.getContractFactory("MockRobinhoodToken");
  const aapl = await MockRobinhoodToken.deploy("Mock AAPL", "AAPL");
  await aapl.waitForDeployment();
  const aaplAddr = await aapl.getAddress();
  console.log(`Mock AAPL: ${aaplAddr}`);
  await (await aapl.mint(deployer.address, ethers.parseUnits("1000", 18))).wait();
  console.log(`  minted 1000 AAPL to deployer`);

  // 3. Mock Chainlink price feed for AAPL (8 decimals, 311.52209667)
  console.log("\n=== Deploying Mock AAPL Price Feed (8 decimals) ===");
  const MockFeed = await ethers.getContractFactory("MockChainlinkFeed");
  const priceAnswer = 31152209667n; // 311.52 * 1e8
  const now = Math.floor(Date.now()/1000);
  const feed = await MockFeed.deploy(priceAnswer, 8, now);
  await feed.waitForDeployment();
  const feedAddr = await feed.getAddress();
  console.log(`Mock AAPL Feed: ${feedAddr} (price 311.52209667)`);

  // 4. Mock Sequencer Uptime Feed (answer 0 = up)
  console.log("\n=== Deploying Mock Sequencer Uptime Feed (answer 0) ===");
  const sequencer = await MockFeed.deploy(0, 0, now);
  await sequencer.waitForDeployment();
  const seqAddr = await sequencer.getAddress();
  console.log(`Mock Sequencer: ${seqAddr} (answer 0)`);

  // 5. Mock Uniswap V3 Router (simple mock that just transfers)
  console.log("\n=== Deploying Mock Uniswap V3 Router ===");
  const MockRouter = await ethers.getContractFactory("MockUniswapV3Router");
  const router = await MockRouter.deploy();
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log(`Mock Router: ${routerAddr}`);

  console.log("\n=== Summary for .env ===");
  console.log(`ROBINHOOD_USDC_ADDRESS=${usdgAddr}`);
  console.log(`ROBINHOOD_STOCK_TOKEN_ADDRESSES=${aaplAddr}`);
  console.log(`ROBINHOOD_SEQUENCER_FEED=${seqAddr}`);
  console.log(`ROBINHOOD_UNISWAP_V3_ROUTER=${routerAddr}`);
  console.log(`ROBINHOOD_AAPL_FEED=${feedAddr}`);
  console.log(`\nNext: set these in contracts/.env and run:`);
  console.log(`npx hardhat run scripts/deployV2.ts --network robinhoodTestnet`);
  console.log(`\nAlso need to set feed for equity adapter after deploy: ChainlinkEquityFeedAdapter.registerFeed with aapl->feed`);
}

main().catch((e)=>{console.error(e); process.exit(1)});
