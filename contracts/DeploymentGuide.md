# Red Chips Protocol - Production Deployment Guide

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              MARKETFACTORY (One per chain)              │
│  ✓ Stablecoin whitelist                                 │
│  ✓ Market creation with 0.5% fee                        │
│  ✓ Oracle validation                                    │
│  ✓ Duplicate prevention                                 │
│  ✓ Global registry                                      │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│          LENDINGMARKET (One per LP/asset pair)          │
│  ✓ LP share-based liquidity management                  │
│  ✓ Uniswap V3 TWAP + Chainlink fallback                │
│  ✓ Circuit breaker (volatility detection)              │
│  ✓ Multi-asset support (ERC20/721/1155)                │
│  ✓ Loan registry                                        │
│  ✓ Revenue share: 90% LP, 10% protocol                 │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│         LOANCONTRACT (One per loan - minimal proxy)     │
│  ✓ Isolated collateral escrow                           │
│  ✓ 0.5% origination fee → treasury                      │
│  ✓ Health factor monitoring                             │
│  ✓ Time + health-based liquidation                      │
│  ✓ Gradual liquidation (ERC20), full (NFT)             │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Contract Files Created

### Core Contracts
1. **interfaces/IMarketFactory.sol** - Factory interface
2. **interfaces/ILendingMarket.sol** - Market interface
3. **interfaces/ILoanContract.sol** - Loan interface
4. **interfaces/IOracle.sol** - Oracle interfaces

### Libraries
5. **libraries/UniswapV3TWAPOracle.sol** - Uniswap V3 TWAP integration
6. **libraries/ChainlinkOracle.sol** - Chainlink fallback oracle
7. **libraries/CircuitBreaker.sol** - On-chain volatility detection
8. **libraries/AssetHandler.sol** - Multi-asset transfer handler

### Main Contracts
9. **LoanContract.sol** - Individual loan escrow (minimal proxy)
10. **LendingMarket.sol** - Isolated market logic
11. **MarketFactory.sol** - Market deployment factory

---

## 🚀 Deployment Steps

### Step 1: Deploy Core Infrastructure

```javascript
// 1. Deploy LoanContract implementation (once per chain)
const LoanContract = await ethers.getContractFactory("LoanContract");
const loanImplementation = await LoanContract.deploy();
await loanImplementation.deployed();

console.log("LoanContract implementation:", loanImplementation.address);

// 2. Deploy MarketFactory
const MarketFactory = await ethers.getContractFactory("MarketFactory");
const factory = await MarketFactory.deploy(
    owner.address,              // Initial owner
    treasuryAddress,            // Protocol treasury (multi-sig)
    loanImplementation.address  // Loan implementation for cloning
);
await factory.deployed();

console.log("MarketFactory:", factory.address);
```

### Step 2: Configure Stablecoins (per chain)

```javascript
// Ethereum Mainnet
await factory.addStablecoin(
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    6  // decimals
);
await factory.addStablecoin(
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    6
);
await factory.addStablecoin(
    "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    18
);

// Base
await factory.addStablecoin(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    6
);

// Arbitrum
await factory.addStablecoin(
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
    6
);
await factory.addStablecoin(
    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // USDT
    6
);

// Optimism
await factory.addStablecoin(
    "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC
    6
);
```

### Step 3: Create a Market (Example)

```javascript
// Market Parameters
const collateralAsset = "0x..." // WETH address
const loanAsset = "0x..."       // USDC address
const assetType = 0;            // ERC20
const oracleType = 0;           // UNISWAP_V3_TWAP
const uniV3Pool = "0x...";      // WETH/USDC 0.3% pool
const nftOracle = ethers.constants.AddressZero;
const ltvBps = 7500;            // 75%
const aprBps = 1200;            // 12%
const durationSeconds = 30 * 24 * 3600; // 30 days
const initialLiquidity = ethers.utils.parseUnits("10000", 6); // 10,000 USDC

// Approve factory to spend
await usdc.approve(factory.address, initialLiquidity);

// Create market
const tx = await factory.createMarket(
    collateralAsset,
    loanAsset,
    assetType,
    oracleType,
    uniV3Pool,
    nftOracle,
    ltvBps,
    aprBps,
    durationSeconds,
    initialLiquidity
);

const receipt = await tx.wait();
const marketAddress = receipt.events.find(e => e.event === 'MarketCreated').args.market;

console.log("Market created:", marketAddress);
```

---

## 🔐 Security Considerations

### Pre-Deployment Checklist

- [ ] **Treasury is multi-sig** (Gnosis Safe 3-of-5 minimum)
- [ ] **Test on testnet first** (Sepolia, Base Sepolia, Arbitrum Sepolia)
- [ ] **Verify all oracle configurations** (check pool liquidity > $1M)
- [ ] **Review all whitelisted stablecoins** (legitimate contracts only)
- [ ] **Set up monitoring** (health factor tracking, circuit breaker alerts)
- [ ] **Prepare incident response plan**
- [ ] **Get professional security audit** (Trail of Bits, OpenZeppelin, ConsenSys Diligence)
- [ ] **Bug bounty program** (Immunefi)
- [ ] **Test liquidation scenarios** (underwater loans, NFT sales)
- [ ] **Verify gas costs** (loan creation ~50k gas with proxy)

### Production Safeguards

```javascript
// 1. Use Timelock for critical functions
const Timelock = await ethers.getContractFactory("TimelockController");
const timelock = await Timelock.deploy(
    2 * 24 * 60 * 60, // 2-day delay
    [multisig.address], // Proposers
    [multisig.address], // Executors
    deployer.address    // Admin
);

// 2. Transfer factory ownership to timelock
await factory.transferOwnership(timelock.address);

// 3. Verify contracts on Etherscan
await hre.run("verify:verify", {
    address: factory.address,
    constructorArguments: [owner, treasury, loanImplementation.address],
});
```

---

## 📊 Fee Structure

### Creation Fee
- **Rate**: 0.5% of initial liquidity
- **Recipient**: Protocol treasury
- **Example**: 10,000 USDC deposit → 50 USDC fee, 9,950 USDC to market

### Origination Fee
- **Rate**: 0.5% of loan principal
- **Recipient**: Protocol treasury
- **Example**: 1,500 USDC loan → 7.50 USDC fee, 1,492.50 USDC to borrower

### Revenue Share
- **Protocol**: 10% of interest earned
- **LP**: 90% of interest earned
- **Example**: 150 USDC interest → 15 USDC protocol, 135 USDC LP

---

## 🌐 Multi-Chain Deployment

### Supported Chains (EVM)
1. **Ethereum Mainnet** - Highest security, highest cost
2. **Base** - Coinbase L2, fast & cheap
3. **Arbitrum** - Established L2, great liquidity
4. **Optimism** - OP Stack, wide adoption

### Chain-Specific Configuration

```javascript
const chainConfig = {
    ethereum: {
        chainId: 1,
        uniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    base: {
        chainId: 8453,
        uniswapV3Factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
        weth: "0x4200000000000000000000000000000000000006",
        usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    arbitrum: {
        chainId: 42161,
        uniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    },
    optimism: {
        chainId: 10,
        uniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        weth: "0x4200000000000000000000000000000000000006",
        usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    }
};
```

### Using CREATE2 for Deterministic Addresses

```javascript
// Deploy same address across chains
const salt = ethers.utils.id("RedChips_v1_Factory");

const factory = await ethers.getContractFactory("MarketFactory");
const deployTransaction = await factory.getDeployTransaction(
    owner.address,
    treasury.address,
    loanImplementation.address
);

const create2Address = ethers.utils.getCreate2Address(
    deployer.address,
    salt,
    ethers.utils.keccak256(deployTransaction.data)
);

console.log("Will deploy to:", create2Address, "on all chains");
```

---

## 🧪 Testing Guide

### Unit Tests

```javascript
describe("MarketFactory", function() {
    it("Should create market with correct parameters", async function() {
        const tx = await factory.createMarket(...params);
        expect(await factory.isMarket(marketAddress)).to.be.true;
    });
    
    it("Should prevent duplicate markets", async function() {
        await factory.createMarket(...params);
        await expect(factory.createMarket(...params))
            .to.be.revertedWith("DuplicateMarket");
    });
    
    it("Should collect 0.5% creation fee", async function() {
        const initialBalance = await usdc.balanceOf(treasury);
        await factory.createMarket(...params);
        const finalBalance = await usdc.balanceOf(treasury);
        expect(finalBalance.sub(initialBalance)).to.equal(expectedFee);
    });
});

describe("LendingMarket", function() {
    it("Should create isolated loan contract", async function() {
        const tx = await market.requestLoan(collateralAmount, 0, 0);
        const loanAddress = receipt.events.find(e => e.event === 'LoanCreated').args.loanContract;
        expect(await market.isLoan(loanAddress)).to.be.true;
    });
    
    it("Should trigger circuit breaker on 20% volatility", async function() {
        // Simulate price volatility
        await expect(market.requestLoan(...))
            .to.be.revertedWith("CircuitBreakerActive");
    });
});

describe("LoanContract", function() {
    it("Should repay loan and return collateral", async function() {
        await loan.repay();
        expect(await collateralToken.balanceOf(borrower)).to.equal(collateralAmount);
    });
    
    it("Should liquidate underwater loan", async function() {
        // Drop collateral price
        await loan.liquidate();
        expect(await loan.status()).to.equal(LoanStatus.LIQUIDATED);
    });
});
```

### Integration Tests

```javascript
describe("End-to-End Flow", function() {
    it("Full lifecycle: create market → deposit → borrow → repay", async function() {
        // 1. Create market
        const market = await factory.createMarket(...);
        
        // 2. LP deposits liquidity
        await market.depositLiquidity(amount);
        
        // 3. Borrower requests loan
        const loan = await market.requestLoan(...);
        
        // 4. Borrower repays
        await loan.repay();
        
        // 5. LP withdraws
        await market.withdrawLiquidity(shares);
    });
});
```

---

## 📈 Monitoring & Analytics

### Key Metrics to Track

```javascript
// Market health
const { totalLiquidity, reservedLiquidity, utilizationRate } = 
    await market.getMarketStats();

// Factory stats
const { totalCreated, totalActive, totalFees } = 
    await factory.getFactoryStats();

// Individual loan health
const healthFactor = await loan.getHealthFactor();
if (healthFactor < ethers.utils.parseEther("1.2")) {
    // Alert: Loan at risk of liquidation
}

// Circuit breaker status
const isTriggered = await market.isCircuitBreakerTriggered();
if (isTriggered) {
    // Alert: Market paused due to volatility
}
```

### Event Monitoring (The Graph)

```graphql
type Market @entity {
  id: ID!
  owner: Bytes!
  collateralAsset: Bytes!
  loanAsset: Bytes!
  totalLiquidity: BigInt!
  reservedLiquidity: BigInt!
  activeLoanCount: Int!
  createdAt: BigInt!
}

type Loan @entity {
  id: ID!
  market: Market!
  borrower: Bytes!
  principal: BigInt!
  collateralAmount: BigInt!
  healthFactor: BigInt!
  status: LoanStatus!
  createdAt: BigInt!
}
```

---

## 🛠️ User Flows

### For Market Creators (LPs)

```javascript
// 1. Approve USDC
await usdc.approve(factoryAddress, initialLiquidity);

// 2. Create market
const tx = await factory.createMarket(
    wethAddress,        // Accept WETH as collateral
    usdcAddress,        // Lend USDC
    AssetType.ERC20,    // ERC20 collateral
    OracleType.UNISWAP_V3_TWAP,
    wethUsdcPool,       // Uniswap V3 pool
    AddressZero,        // No NFT oracle
    7500,               // 75% LTV
    1000,               // 10% APR
    30 * 86400,         // 30 days
    parseUnits("5000", 6) // 5,000 USDC initial liquidity
);

// 3. Receive LP shares
const market = await tx.wait();
```

### For Borrowers

```javascript
// 1. Approve collateral
await weth.approve(marketAddress, collateralAmount);

// 2. Request loan
const tx = await market.requestLoan(
    parseEther("1"), // 1 WETH collateral
    0,               // tokenId (for NFTs)
    0                // erc1155Amount
);

// 3. Receive USDC (minus 0.5% fee)
// 1 WETH @ $3000 = $3000 value
// 75% LTV = $2250 max loan
// 0.5% fee = $11.25
// Net received: $2238.75 USDC
```

### For Liquidators

```javascript
// 1. Monitor loans for liquidation opportunities
const loans = await market.getAllLoans();

for (const loanAddress of loans) {
    const loan = await ethers.getContractAt("LoanContract", loanAddress);
    const canLiquidate = await loan.isLiquidatable();
    const healthFactor = await loan.getHealthFactor();
    
    if (canLiquidate) {
        // 2. Approve repayment
        const { principal, interestAmount } = await loan.getLoanDetails();
        const totalDebt = principal.add(interestAmount);
        await usdc.approve(loanAddress, totalDebt);
        
        // 3. Liquidate and receive collateral + penalty
        await loan.liquidate();
    }
}
```

---

## ⚠️ Known Limitations & Future Improvements

### Current Limitations
1. **NFT Oracle**: Requires external Reservoir/OpenSea API integration
2. **Gas Costs**: ~50k per loan (minimal proxy), could be optimized further
3. **Single-chain Liquidity**: No cross-chain borrowing (yet)
4. **Fixed Parameters**: Market terms cannot be updated after creation