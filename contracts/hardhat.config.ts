import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

// Environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";
const ROBINHOOD_RPC_URL = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 20,
          },
          viaIR: true,
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
      forking: {
        url: process.env.MAINNET_RPC_URL || "",
        enabled: false,
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // Ethereum Sepolia Testnet
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo",
      chainId: 11155111,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },

    // Base Sepolia Testnet
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      chainId: 84532,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },

    // Ethereum Mainnet
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      chainId: 1,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },

    // Base Mainnet (for future)
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      accounts: [PRIVATE_KEY],
    },

    // Robinhood Chain Mainnet. Deployment remains blocked until all provider
    // manifest values (USDC, sequencer health, router, feeds, and legal controls)
    // are independently verified and supplied to deployV2.ts.
    robinhood: {
      url: ROBINHOOD_RPC_URL,
      chainId: 4663,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
    robinhoodTestnet: {
      url: process.env.ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com",
      chainId: 46630,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
  },

  // Etherscan V2 unified API
  etherscan: {
    apiKey: ETHERSCAN_API_KEY || BASESCAN_API_KEY,
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "robinhoodTestnet",
        chainId: 46630,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com",
        },
      },
      {
        network: "robinhood",
        chainId: 4663,
        urls: {
          apiURL: "https://explorer.chain.robinhood.com/api",
          browserURL: "https://explorer.chain.robinhood.com",
        },
      },
    ],
  },

  // Etherscan V2 API (single key)
  sourcify: {
    enabled: false,
  },

  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Gas reporting
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
};

export default config;
