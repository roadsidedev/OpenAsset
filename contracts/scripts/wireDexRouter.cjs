const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const ROUTERS = {
  baseSepolia: "0x94cc0aac535ccdb3c01d6787d6413c739ae12bc4",
  robinhoodTestnet: (process.env.ROBINHOOD_UNISWAP_V3_ROUTER || "").toLowerCase(),
};

const ABI = [
  "function approvedRouters(address) view returns (bool)",
  "function addApprovedRouter(address)",
  "function setRouter(address)",
  "function getMarketLiquidationConfig(address) view returns (address,uint24,uint16,bool)","function router() view returns (address)","function approvedRouters(address) view returns (bool)",
];

async function main() {
  const networkName = hre.network.name;
  const deploymentPath = path.join(__dirname, "..", "deployments", `${networkName}-v2.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const dex = (deployment.contracts.dexSwapLiquidation || "").toLowerCase();
  const router = (ROUTERS[networkName] || "").toLowerCase();
  if (!router) throw new Error(`No router configured for ${networkName}`);

  console.log('step: signers'); const [signer] = await hre.ethers.getSigners(); console.log('step: signer ok', signer.address);
  const adapter = await hre.ethers.getContractAt(ABI, dex, signer);
  console.log('net:', hre.network.name, 'router:', JSON.stringify(router), 'dex:', JSON.stringify(dex)); console.log('step: call'); let already = false; try { already = await adapter.approvedRouters(router); } catch (e) { console.log('call trace:', (e.stack||'').split('\n').slice(0,12).join('\n')); throw e; }
  if (!already) {
    console.log(`addApprovedRouter(${router})`);
    await (await adapter.addApprovedRouter(router)).wait();
  } else {
    console.log("router already allowlisted");
  }
  console.log("setRouter(...)");
  await (await adapter.setRouter(router)).wait();
  const cfg = await adapter.getMarketLiquidationConfig("0x0000000000000000000000000000000000000000");
  console.log("approved:", await adapter.approvedRouters(router)); console.log("router():", await adapter.router()); console.log("view effRouter:", (await adapter.getMarketLiquidationConfig("0x0000000000000000000000000000000000000000"))[0]);
}
main().catch((e) => { console.error("ERR:", e.shortMessage || e.message); process.exit(1); });
