import { ethers } from "hardhat";
async function main(){
  const factoryAddr="0xFa615F9b9187399dB68357A3445383E1cbc8a12c";
  const factory=await ethers.getContractAt("MarketFactoryV2", factoryAddr);
  const count=await factory.getMarketCount();
  console.log("count", count.toString());
  const all=await factory.getAllMarkets();
  console.log(all);
  for(const m of all){
    const c=await ethers.getContractAt("LendingMarketV2", m);
    try{
      const stats=await c.getMarketStats();
      console.log(m, "stats", stats);
    }catch(e){console.log(m, "err", e)}
  }
}
main().catch(e=>{console.error(e); process.exit(1)})
