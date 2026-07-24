import { ethers } from "hardhat";
import * as fs from "fs";

/**
 * OpenAsset Market Protocol - Contract Verification Script
 * Uses Etherscan V2 API for contract verification
 * 
 * Usage:
 *   npx hardhat run scripts/verify.ts --network sepolia
 *   npx hardhat run scripts/verify.ts --network baseSepolia
 */

interface DeploymentData {
  loanImplementation: string;
  nftOracle: string;
  marketFactory: string;
  treasury: string;
  deployer: string;
  chainId: number;
}

// Etherscan V2 API endpoints
const ETHERSCAN_APIS: Record<number, {
  url: string;
  name: string;
  apiKeyEnv: string;
}> = {
  // Sepolia
  11155111: {
    url: "https://api-sepolia.etherscan.io/api",
    name: "Etherscan Sepolia",
    apiKeyEnv: "ETHERSCAN_API_KEY",
  },
  // Base Sepolia
  84532: {
    url: "https://api-sepolia.basescan.org/api",
    name: "Basescan Sepolia",
    apiKeyEnv: "BASESCAN_API_KEY",
  },
  // Ethereum Mainnet
  1: {
    url: "https://api.etherscan.io/api",
    name: "Etherscan",
    apiKeyEnv: "ETHERSCAN_API_KEY",
  },
  // Base Mainnet
  8453: {
    url: "https://api.basescan.org/api",
    name: "Basescan",
    apiKeyEnv: "BASESCAN_API_KEY",
  },
};

// Testnet Chainlink addresses for constructor args
const CHAINLINK_ETH_USD: Record<number, string> = {
  11155111: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // Sepolia
  84532: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",    // Base Sepolia
};

async function main() {
  console.log("\n🔍 OpenAsset Market Protocol - Contract Verification\n");
  console.log("=".repeat(50));

  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const apiConfig = ETHERSCAN_APIS[chainId];
  if (!apiConfig) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const apiKey = process.env[apiConfig.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing API key: Set ${apiConfig.apiKeyEnv} in .env`);
  }

  console.log(`📍 Network: ${apiConfig.name} (Chain ID: ${chainId})`);
  console.log(`🔗 API: ${apiConfig.url}`);

  // Load deployment data
  const deploymentPath = `./deployments/${getNetworkName(chainId)}.json`;
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment not found: ${deploymentPath}\nRun deploy.ts first.`);
  }

  const deployment: DeploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log(`\n📋 Verifying contracts from: ${deploymentPath}`);

  // Verify each contract
  await verifyContract(
    apiConfig.url,
    apiKey,
    "LoanContract",
    deployment.loanImplementation,
    []
  );

  await verifyContract(
    apiConfig.url,
    apiKey,
    "NFTOracle",
    deployment.nftOracle,
    [deployment.deployer, CHAINLINK_ETH_USD[chainId]]
  );

  await verifyContract(
    apiConfig.url,
    apiKey,
    "MarketFactory",
    deployment.marketFactory,
    [deployment.deployer, deployment.treasury, deployment.loanImplementation]
  );

  console.log("\n" + "=".repeat(50));
  console.log("✅ Verification complete!");
  console.log("=".repeat(50));
}

async function verifyContract(
  apiUrl: string,
  apiKey: string,
  contractName: string,
  address: string,
  constructorArgs: any[]
) {
  console.log(`\n📝 Verifying ${contractName} at ${address}...`);

  try {
    // Use Hardhat's built-in verification with Etherscan V2
    const { run } = await import("hardhat");
    
    await run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
      contract: `src/${contractName}.sol:${contractName}`,
    });

    console.log(`   ✅ ${contractName} verified!`);
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log(`   ⚠️  ${contractName} already verified`);
    } else if (error.message.includes("does not have bytecode")) {
      console.log(`   ❌ ${contractName} not deployed at this address`);
    } else {
      console.log(`   ❌ Verification failed: ${error.message}`);
      
      // Try manual verification via API
      console.log(`   🔄 Attempting manual verification via API...`);
      await manualVerify(apiUrl, apiKey, contractName, address, constructorArgs);
    }
  }
}

async function manualVerify(
  apiUrl: string,
  apiKey: string,
  contractName: string,
  address: string,
  constructorArgs: any[]
) {
  // Encode constructor arguments
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  let encodedConstructorArgs = "";
  
  if (constructorArgs.length > 0) {
    // Get types from contract ABI
    const artifact = await import(`../artifacts/src/${contractName}.sol/${contractName}.json`);
    const constructor = artifact.abi.find((item: any) => item.type === "constructor");
    
    if (constructor) {
      const types = constructor.inputs.map((input: any) => input.type);
      encodedConstructorArgs = abiCoder.encode(types, constructorArgs).slice(2);
    }
  }

  // Build verification request
  const params = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: await getSourceCode(contractName),
    codeformat: "solidity-single-file",
    contractname: contractName,
    compilerversion: "v0.8.20+commit.a1b79de6",
    optimizationUsed: "1",
    runs: "200",
    constructorArguements: encodedConstructorArgs,
    evmversion: "paris",
  });

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const result = await response.json();
    
    if (result.status === "1") {
      console.log(`   ✅ Submitted! GUID: ${result.result}`);
      console.log(`   ⏳ Verification may take a few minutes...`);
    } else {
      console.log(`   ❌ API Error: ${result.result}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
}

async function getSourceCode(contractName: string): Promise<string> {
  // For production, use hardhat-flattener or solidity-flattener
  // This is a simplified version - in practice, use the flattened source
  const path = `./src/${contractName}.sol`;
  if (fs.existsSync(path)) {
    return fs.readFileSync(path, "utf8");
  }
  return "";
}

function getNetworkName(chainId: number): string {
  const names: Record<number, string> = {
    11155111: "sepolia",
    84532: "base-sepolia",
    1: "mainnet",
    8453: "base",
  };
  return names[chainId] || `chain-${chainId}`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
