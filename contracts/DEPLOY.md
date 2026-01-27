# Red Chips Protocol - Testnet Deployment Guide

## Prerequisites

1. **Node.js** >= 18.0.0
2. **Wallet** with testnet ETH:
   - [Sepolia Faucet](https://sepoliafaucet.com/)
   - [Base Sepolia Faucet](https://docs.base.org/tools/bridges-faucets/)
3. **RPC Endpoints** (free from [Alchemy](https://alchemy.com) or [Infura](https://infura.io))
4. **API Keys** for contract verification:
   - [Etherscan](https://etherscan.io/apis)
   - [Basescan](https://basescan.org/apis)

## Quick Start

### 1. Install Dependencies

```bash
cd contracts
npm install
```

### 2. Configure Environment

```bash
# Copy template
cp .env.example .env

# Edit with your values
# REQUIRED:
#   - PRIVATE_KEY: Your wallet private key
#   - SEPOLIA_RPC_URL: Alchemy/Infura RPC for Sepolia
#   - BASE_SEPOLIA_RPC_URL: Base Sepolia RPC
```

### 3. Compile Contracts

```bash
npm run compile
```

### 4. Deploy to Testnet

**Sepolia:**
```bash
npm run deploy:sepolia
```

**Base Sepolia:**
```bash
npm run deploy:base-sepolia
```

### 5. Verify Contracts (Optional)

```bash
npm run verify:sepolia
# or
npm run verify:base-sepolia
```

### 6. Create Test Market

```bash
npm run create-market:sepolia
```

## Deployed Contract Addresses

After deployment, save your addresses:

| Contract | Sepolia | Base Sepolia |
|----------|---------|--------------|
| LoanContract | `0x...` | `0x...` |
| NFTOracle | `0x...` | `0x...` |
| MarketFactory | `0x...` | `0x...` |

## Testnet Resources

### Sepolia (Chain ID: 11155111)
- **USDC**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Chainlink ETH/USD**: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- **Explorer**: https://sepolia.etherscan.io

### Base Sepolia (Chain ID: 84532)
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Chainlink ETH/USD**: `0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1`
- **Explorer**: https://sepolia.basescan.org

## Troubleshooting

### "Insufficient funds"
Get testnet ETH from faucets listed above.

### "Contract verification failed"
Wait 1-2 minutes after deployment, then retry verification.

### "Nonce too low"
Reset your wallet's nonce or wait for pending transactions.

## Security Notes

⚠️ **Never commit `.env` with real private keys!**

- Use separate wallets for testnets
- The `.env` file is gitignored
- For production, use hardware wallets or multi-sig
