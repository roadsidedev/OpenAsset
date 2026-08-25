import { ethers } from "hardhat";
async function main(){
  const [deployer]=await ethers.getSigners();
  const bal=await ethers.provider.getBalance(await deployer.getAddress());
  console.log(`chain ${ (await ethers.provider.getNetwork()).chainId } deployer ${await deployer.getAddress()} bal ${bal.toString()} eth ${Number(bal)/1e18}`);
}
main().catch(e=>{console.error(e.message); process.exit(1)})
