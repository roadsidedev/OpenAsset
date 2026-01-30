# Red Chips - Remix Deployment Guide

## 📁 Flattened Contracts

All contracts are flattened with dependencies inlined for direct Remix deployment:

| Contract | File | Purpose |
|----------|------|---------|
| **NFTOracle** | `NFTOracle_Flat.sol` | NFT floor price oracle with Chainlink ETH/USD |
| **LoanContract** | `LoanContract_Flat.sol` | Individual loan escrow (deployed via proxy) |
| **LendingMarket** | `LendingMarket_Flat.sol` | Isolated lending pool with LP tokens |
| **MarketFactory** | `MarketFactory_Flat.sol` | Factory for deploying markets |

---

## 🚀 Deployment Order

Deploy in this exact order:

### 1. Deploy LoanContract (Implementation)
```
Contract: LoanContract
Constructor: None
```
This is the implementation contract for minimal proxies.

### 2. Deploy NFTOracle (if using NFT collateral)
```
Contract: NFTOracle
Constructor Args:
  - initialOwner: Your wallet address
  - _ethUsdPriceFeed: Chainlink ETH/USD feed address
```

**Chainlink ETH/USD Feeds:**
- Sepolia: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- Mainnet: `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`

### 3. Deploy MarketFactory
```
Contract: MarketFactory
Constructor Args:
  - initialOwner: Your wallet address
  - treasury: Treasury address for fees
  - loanImpl: LoanContract address from step 1
```

### 4. Configure Factory
After deploying MarketFactory, call these admin functions:

```solidity
// Add stablecoins to whitelist
addStablecoin(USDC_ADDRESS, 6);
addStablecoin(USDT_ADDRESS, 6);
addStablecoin(DAI_ADDRESS, 18);
```

**Sepolia Stablecoin Addresses:**
- Mock USDC: Deploy your own or use testnet faucets
- Use any ERC20 for testing

### 5. Deploy LendingMarket (Manual)
```
Contract: LendingMarket
Constructor Args:
  - marketOwner_: Market creator's wallet
  - collateralAsset_: Collateral token address
  - loanAsset_: Stablecoin address
  - protocolTreasury_: Treasury address
  - loanImplementation_: LoanContract address
  - assetType_: 0=ERC20, 1=ERC721, 2=ERC1155
  - oracleType_: 0=Uniswap TWAP, 1=Chainlink, 2=NFT Oracle
  - primaryOracle_: Oracle address
  - nftOracle_: NFT oracle (or address(0))
  - ltvBps_: e.g., 7000 = 70% LTV
  - aprBps_: e.g., 1000 = 10% APR
  - durationSeconds_: e.g., 2592000 = 30 days
  - healthFactorThreshold_: e.g., 12000 = 120%
  - cbConfig_: Circuit breaker config tuple
```

---

## ⚙️ Remix Settings

1. **Compiler**: `0.8.20`
2. **EVM Version**: `paris` or `shanghai`
3. **Optimization**: `200 runs`
4. **Enable optimization**: ✅

---

## 🧪 Testing Flow

1. Deploy LoanContract implementation
2. Deploy NFTOracle (if needed)
3. Deploy LendingMarket with test parameters
4. Call `initializeWithLiquidity()` to fund the market
5. Approve collateral token for LendingMarket
6. Call `requestLoan()` to create a loan
7. Call `repay()` on the LoanContract to close it

---

## 📋 Constructor Args Reference

### CircuitBreakerConfig Tuple
```
[true, 2000, 3600, 1000, 7200]
```
- enabled: true
- pauseThresholdBps: 2000 (20%)
- lookbackSeconds: 3600 (1 hour)
- resumeThresholdBps: 1000 (10%)
- cooldownSeconds: 7200 (2 hours)

---

## 🔗 Useful Links

- [Remix IDE](https://remix.ethereum.org)
- [Sepolia Faucet](https://www.sepoliafaucet.io)
- [Chainlink Data Feeds](https://docs.chain.link/data-feeds/price-feeds/addresses)
