import { ethers } from "hardhat";

async function main(){
  const [deployer]=await ethers.getSigners();
  console.log("deployer", await deployer.getAddress());
  const network=await ethers.provider.getNetwork();
  console.log("chain", Number(network.chainId));
  const isBaseSepolia=Number(network.chainId)===84532;
  if(!isBaseSepolia){ console.log("only for baseSepolia"); return; }

  const factoryAddr="0xFa615F9b9187399dB68357A3445383E1cbc8a12c";
  const registryAddr="0x80f70Da0e0e7A2b9D3A1eE4956309b295329A7D7";
  const b20AssetAdapter="0x9163527519461FCc6b0c2fC0d4b1CF37Cfc54493";
  const b20Policy="0xe894687bA1Dca31C73c5C0C6054d73513049fA61";
  const equityAdapter="0x24a5dED622d3CB0815dFC56dE11Da6AcF71d7351";
  const soulbound="0x9c4e5AB78DF11d8273Dfa5eB232768765a3394cC";
  const dexSwap="0x569F318CFfd60C3b305aa082050c59f192d4c5F0";
  const usdc="0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  // deploy MockB20
  console.log("Deploy MockB20...");
  const MockB20=await ethers.getContractFactory("MockB20");
  const mockB20=await MockB20.deploy("Mock B20 AAPLc","AAPLc");
  await mockB20.waitForDeployment();
  const mockB20Addr=await mockB20.getAddress();
  console.log("MockB20", mockB20Addr);
  await (await mockB20.mint(await deployer.getAddress(), ethers.parseEther("1000"))).wait();
  console.log("minted 1000");

  // deploy mock feed (2000 USD, 8 dec)
  const MockFeed=await ethers.getContractFactory("MockChainlinkFeed");
  const feed=await MockFeed.deploy(2000n*10n**8n, 8, 0);
  await feed.waitForDeployment();
  const feedAddr=await feed.getAddress();
  console.log("MockFeed", feedAddr);

  // usdc balance
  const usdcC=await ethers.getContractAt("IERC20", usdc);
  const bal=await usdcC.balanceOf(await deployer.getAddress());
  console.log("USDC bal", bal.toString());

  const factory=await ethers.getContractAt("MarketFactoryV2", factoryAddr);
  // check allowed
  const allowed=await factory.isAllowedLendingAsset(usdc);
  console.log("USDC allowed", allowed);

  const initialLiquidity=ethers.parseUnits("1",6); // 1 USDC
  // approve USDC to factory
  console.log("approving USDC...");
  await (await usdcC.approve(factoryAddr, initialLiquidity)).wait();

  // approve MockB20 to B20AssetAdapter for future escrow (not needed for creation, but for loan)
  // Market will need allowance to adapter; we approve adapter now
  const mockB20Contract=await ethers.getContractAt("MockB20", mockB20Addr);
  // For market creation, no approval needed, but for later loan, borrower approves adapter
  // Do a dummy approve
  await (await mockB20Contract.approve(b20AssetAdapter, ethers.parseEther("100"))).wait();

  const config={
    lpAddress: await deployer.getAddress(),
    collateralAsset: mockB20Addr,
    assetAdapter: b20AssetAdapter,
    oracleAdapter: equityAdapter,
    complianceAdapter: b20Policy,
    liquidationAdapter: dexSwap,
    positionAdapter: soulbound,
    lendingAsset: usdc,
    ltvBasisPoints: 6500,
    aprBasisPoints: 1200,
    durationSeconds: 30*86400,
    gracePeriodHours: 72,
    enableHealthFactor: true,
    healthFactorThreshold: 12000,
    enableCircuitBreaker: true,
    pauseThresholdBps: 1000,
    lookbackPeriodSeconds: 86400,
    resumeThresholdBps: 500,
    cooldownSeconds: 4*3600
  };

  console.log("creating market...");
  const tx=await factory.createMarket(config, initialLiquidity, { value: 0 });
  const receipt=await tx.wait();
  console.log("tx", receipt?.hash);
  let marketAddr: string | undefined;
  for(const log of receipt?.logs||[]){
    try{
      const parsed=factory.interface.parseLog(log as any);
      if(parsed?.name==="MarketCreated"){
        marketAddr=parsed.args.marketAddress;
        console.log("MarketCreated", marketAddr, "collateral", parsed.args.collateralAsset);
      }
    }catch{}
  }
  if(!marketAddr){ console.log("no MarketCreated event"); return; }

  // register equity feed per market (90000, no sequencer) — now onlyFactoryOrOwner, deployer is owner
  const equity=await ethers.getContractAt("ChainlinkEquityFeedAdapter", equityAdapter);
  console.log("registering equity feed 90000, sequencer 0 as owner...");
  await (await equity.registerFeed(marketAddr, feedAddr, 90000, ethers.ZeroAddress)).wait();
  console.log("feed registered");

  // register token for compliance — also onlyFactoryOrOwner
  const compliance=await ethers.getContractAt("B20PolicyComplianceAdapter", b20Policy);
  console.log("registering compliance token as owner...");
  await (await compliance.registerToken(marketAddr, mockB20Addr)).wait();
  console.log("compliance token registered");

  // verify market count
  const count=await factory.getMarketCount();
  console.log("market count", count.toString());
  console.log("done market", marketAddr);
}

main().catch(e=>{console.error(e); process.exit(1)})
