# OpenAsset Market Technical Reference

Version 1.0 | Last Updated: January 2026

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Smart Contracts](#core-smart-contracts)
3. [Oracle & Price Feed System](#oracle--price-feed-system)
4. [Liquidation Mechanisms](#liquidation-mechanisms)
5. [Security Systems](#security-systems)
6. [Multi-Chain Infrastructure](#multi-chain-infrastructure)
7. [Data Models](#data-models)
8. [Integration Patterns](#integration-patterns)

---

## Architecture Overview

### System Philosophy

OpenAsset Market is **permissionless asset lending infrastructure**. Core principles:

- **Isolated Markets**: Each LP's market is independent. Risks don't cascade.
- **LP Control**: Market creators set all terms. Platform enforces basic safety rules only.
- **Security First**: Every design choice prioritizes fund safety over convenience.
- **Chain Agnostic**: Same logic works on EVM and SVM chains.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                            │
│  ├─ React/Next.js Application                                   │
│  ├─ Web3 Wallet Integration (MetaMask, Phantom)                 │
│  └─ Real-time Health Monitoring Dashboard                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                     BACKEND SERVICES                             │
│  ├─ Price Oracle Aggregator (TWAP calculation)                  │
│  ├─ Health Monitoring Service (alert system)                    │
│  ├─ Volatility Analysis Engine                                  │
│  └─ Liquidation Bot (automated execution)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   SMART CONTRACT LAYER                           │
│  ├─ MarketFactory.sol (market deployment)                       │
│  ├─ LendingMarket.sol (isolated market logic)                   │
│  ├─ LoanContract.sol (individual loan escrow)                   │
│  └─ CircuitBreaker.sol (volatility protection)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    BLOCKCHAIN LAYER                              │
│  ├─ EVM Chains: Ethereum, Polygon, Base, Arbitrum              │
│  └─ SVM Chain: Solana                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Contract Interaction Flow

```
LP Creates Market:
MarketFactory.createMarket()
    ├─> Validates configuration
    ├─> Deploys new LendingMarket instance
    ├─> Transfers initial liquidity
    ├─> Registers in global registry
    └─> Emits MarketCreated event

Borrower Requests Loan:
LendingMarket.requestLoan()
    ├─> Fetches TWAP price
    ├─> Checks circuit breaker status
    ├─> Calculates max loan amount
    ├─> Creates LoanContract instance
    ├─> Escrows collateral
    ├─> Transfers funds to borrower
    └─> Emits LoanCreated event

Liquidation Triggered:
LoanContract.liquidate()
    ├─> Verifies liquidation conditions (grace period OR health factor)
    ├─> Executes asset-specific liquidation
    ├─> Distributes proceeds (LP + surplus to borrower)
    └─> Emits Liquidated event
```

---

## Core Smart Contracts

### 1. MarketFactory.sol

**Purpose**: Permissionless market deployment and global registry.

**Key Responsibilities**:

- Deploy isolated LendingMarket contracts
- Validate market configuration parameters
- Maintain global market registry
- Collect creation fees

**Critical Implementation Details**:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MarketFactory is ReentrancyGuard, Ownable {

    // Creation fee structure (immutable after deployment)
    uint256 public constant MIN_CREATION_FEE = 0.05 ether;
    uint256 public constant FEE_PERCENT_BPS = 100; // 1% in basis points
    uint256 public constant MAX_CREATION_FEE = 0.5 ether;

    // Global registry
    address[] public allMarkets;
    mapping(address => address[]) public lpToMarkets; // LP => their markets
    mapping(address => address[]) public assetToMarkets; // Asset => markets accepting it

    // Supported configurations
    address public protocolTreasury;

    struct MarketConfig {
        address lpAddress;
        address collateralAsset;
        AssetType assetType;
        uint256 ltvBasisPoints;        // 5000 = 50%, 10000 = 100%, 15000 = 150%
        uint256 aprBasisPoints;         // 1200 = 12%
        uint256 durationSeconds;        // Loan duration
        uint256 gracePeriodHours;       // Post-expiry grace period
        bool enableHealthFactor;        // Auto-liquidation on price drop
        uint256 healthFactorThreshold;  // 12000 = 120%
        OracleConfig oracleConfig;
        VolatilityConfig volatilityConfig;
    }

    enum AssetType {
        ERC20,
        ERC721,
        ERC1155
    }

    struct OracleConfig {
        OracleType oracleType;
        address primaryOracle;      // Uniswap V3 pool or Chainlink feed
        uint32 twapPeriodSeconds;   // 600-1800 seconds (10-30 min)
    }

    enum OracleType {
        UNISWAP_V3_TWAP,
        CHAINLINK,
        MANUAL
    }

    struct VolatilityConfig {
        bool enableCircuitBreaker;
        uint256 pauseThresholdBps;     // 2000 = 20% move triggers pause
        uint256 lookbackPeriodSeconds;  // Time window to measure volatility
        uint256 resumeThresholdBps;     // 1000 = 10% to resume
        uint256 cooldownSeconds;        // Min time paused before resume
    }

    event MarketCreated(
        address indexed marketAddress,
        address indexed lp,
        address indexed collateralAsset,
        uint256 initialLiquidity,
        uint256 creationFee
    );

    /**
     * @notice Deploy a new isolated lending market
     * @param config Market configuration parameters
     * @return marketAddress Address of deployed market
     */
    function createMarket(
        MarketConfig memory config
    ) external payable nonReentrant returns (address marketAddress) {

        // Extract initial liquidity from msg.value
        uint256 creationFee = calculateCreationFee(msg.value);
        uint256 initialLiquidity = msg.value - creationFee;

        require(initialLiquidity > 0, "No liquidity provided");

        // Validate configuration
        _validateMarketConfig(config);

        // Deploy new market contract
        LendingMarket market = new LendingMarket(
            config.lpAddress,
            config.collateralAsset,
            config.assetType,
            config.ltvBasisPoints,
            config.aprBasisPoints,
            config.durationSeconds,
            config.gracePeriodHours,
            config.enableHealthFactor,
            config.healthFactorThreshold,
            config.oracleConfig,
            config.volatilityConfig
        );

        marketAddress = address(market);

        // Transfer initial liquidity to market
        (bool success, ) = marketAddress.call{value: initialLiquidity}("");
        require(success, "Liquidity transfer failed");

        // Update registries
        allMarkets.push(marketAddress);
        lpToMarkets[config.lpAddress].push(marketAddress);
        assetToMarkets[config.collateralAsset].push(marketAddress);

        // Collect creation fee
        (bool feeSuccess, ) = protocolTreasury.call{value: creationFee}("");
        require(feeSuccess, "Fee transfer failed");

        emit MarketCreated(
            marketAddress,
            config.lpAddress,
            config.collateralAsset,
            initialLiquidity,
            creationFee
        );
    }

    /**
     * @notice Validate market configuration parameters
     */
    function _validateMarketConfig(MarketConfig memory config) internal pure {
        require(config.lpAddress != address(0), "Invalid LP address");
        require(config.collateralAsset != address(0), "Invalid collateral asset");

        // LTV validation
        require(config.ltvBasisPoints >= 1000, "LTV too low (min 10%)");
        require(config.ltvBasisPoints <= 20000, "LTV too high (max 200%)");

        // APR validation
        require(config.aprBasisPoints >= 100, "APR too low (min 1%)");
        require(config.aprBasisPoints <= 10000, "APR too high (max 100%)");

        // Duration validation
        require(config.durationSeconds >= 1 days, "Duration too short");
        require(config.durationSeconds <= 365 days, "Duration too long");

        // Grace period validation
        require(config.gracePeriodHours >= 24, "Grace period too short");
        require(config.gracePeriodHours <= 168, "Grace period too long (max 7 days)");

        // Health factor validation (if enabled)
        if (config.enableHealthFactor) {
            require(
                config.healthFactorThreshold >= 11000 &&
                config.healthFactorThreshold <= 20000,
                "Health threshold must be 110-200%"
            );
        }

        // Oracle validation
        require(config.oracleConfig.primaryOracle != address(0), "Invalid oracle");
        require(
            config.oracleConfig.twapPeriodSeconds >= 600 &&
            config.oracleConfig.twapPeriodSeconds <= 1800,
            "TWAP period must be 10-30 minutes"
        );

        // Circuit breaker validation (if enabled)
        if (config.volatilityConfig.enableCircuitBreaker) {
            require(
                config.volatilityConfig.pauseThresholdBps >= 500 &&
                config.volatilityConfig.pauseThresholdBps <= 10000,
                "Pause threshold must be 5-100%"
            );
        }
    }

    /**
     * @notice Calculate creation fee (1% of deposit, capped)
     */
    function calculateCreationFee(uint256 totalDeposit) public pure returns (uint256) {
        uint256 percentFee = (totalDeposit * FEE_PERCENT_BPS) / 10000;

        if (percentFee < MIN_CREATION_FEE) return MIN_CREATION_FEE;
        if (percentFee > MAX_CREATION_FEE) return MAX_CREATION_FEE;

        return percentFee;
    }

    // View functions
    function getMarketCount() external view returns (uint256) {
        return allMarkets.length;
    }

    function getMarketsForLP(address lp) external view returns (address[] memory) {
        return lpToMarkets[lp];
    }

    function getMarketsForAsset(address asset) external view returns (address[] memory) {
        return assetToMarkets[asset];
    }
}
```

**Design Rationale**:

1. **Why immutable fee structure?**
   - Prevents protocol from changing fees after LPs commit capital
   - Builds trust through predictability
   - LPs can calculate ROI accurately

2. **Why basis points?**
   - Standard financial convention
   - Avoids floating point issues
   - 10000 = 100% allows for precise percentages

3. **Why separate registries?**
   - Fast lookups by LP (see all your markets)
   - Fast lookups by asset (find markets for your token)
   - Gas-efficient iteration

---

### 2. LendingMarket.sol

**Purpose**: Isolated market logic for a single LP and asset type.

**Key Responsibilities**:

- Manage LP liquidity deposits/withdrawals
- Process loan requests
- Enforce TWAP pricing
- Execute circuit breaker logic
- Handle liquidations

**Critical Implementation Details**:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

contract LendingMarket is ReentrancyGuard {

    // Immutable market parameters (set at deployment)
    address public immutable lp;
    address public immutable collateralAsset;
    AssetType public immutable assetType;
    uint256 public immutable ltvBasisPoints;
    uint256 public immutable aprBasisPoints;
    uint256 public immutable durationSeconds;
    uint256 public immutable gracePeriodHours;
    bool public immutable enableHealthFactor;
    uint256 public immutable healthFactorThreshold;

    // Oracle configuration
    OracleType public immutable oracleType;
    address public immutable primaryOracle;
    uint32 public immutable twapPeriodSeconds;

    // Circuit breaker configuration
    bool public immutable circuitBreakerEnabled;
    uint256 public immutable pauseThresholdBps;
    uint256 public immutable lookbackPeriodSeconds;
    uint256 public immutable resumeThresholdBps;
    uint256 public immutable cooldownSeconds;

    // Market state
    uint256 public totalLiquidity;
    uint256 public availableLiquidity;
    uint256 public totalBorrowed;

    MarketStatus public status;
    uint256 public pausedAt;

    // Loan tracking
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId;
    uint256[] public activeLoanIds;

    enum AssetType { ERC20, ERC721, ERC1155 }
    enum OracleType { UNISWAP_V3_TWAP, CHAINLINK, MANUAL }
    enum MarketStatus { ACTIVE, PAUSED_VOLATILITY, PAUSED_MANUAL }

    struct Loan {
        address borrower;
        uint256 collateralAmount;    // For ERC20/ERC1155
        uint256 tokenId;              // For ERC721
        uint256 principal;
        uint256 startTime;
        uint256 expiryTime;
        LoanStatus status;
    }

    enum LoanStatus {
        ACTIVE,
        REPAID,
        LIQUIDATED,
        GRACE_PERIOD
    }

    event LiquidityDeposited(address indexed lp, uint256 amount);
    event LiquidityWithdrawn(address indexed lp, uint256 amount);
    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event LoanRepaid(uint256 indexed loanId, uint256 repaymentAmount);
    event LoanLiquidated(uint256 indexed loanId, uint256 recoveryAmount);
    event CircuitBreakerTriggered(uint256 volatility, uint256 timestamp);
    event MarketResumed(uint256 timestamp);

    modifier onlyLP() {
        require(msg.sender == lp, "Only LP");
        _;
    }

    modifier marketActive() {
        require(status == MarketStatus.ACTIVE, "Market paused");
        _;
    }

    constructor(
        address _lp,
        address _collateralAsset,
        AssetType _assetType,
        uint256 _ltvBasisPoints,
        uint256 _aprBasisPoints,
        uint256 _durationSeconds,
        uint256 _gracePeriodHours,
        bool _enableHealthFactor,
        uint256 _healthFactorThreshold,
        OracleConfig memory _oracleConfig,
        VolatilityConfig memory _volatilityConfig
    ) {
        lp = _lp;
        collateralAsset = _collateralAsset;
        assetType = _assetType;
        ltvBasisPoints = _ltvBasisPoints;
        aprBasisPoints = _aprBasisPoints;
        durationSeconds = _durationSeconds;
        gracePeriodHours = _gracePeriodHours;
        enableHealthFactor = _enableHealthFactor;
        healthFactorThreshold = _healthFactorThreshold;

        oracleType = _oracleConfig.oracleType;
        primaryOracle = _oracleConfig.primaryOracle;
        twapPeriodSeconds = _oracleConfig.twapPeriodSeconds;

        circuitBreakerEnabled = _volatilityConfig.enableCircuitBreaker;
        pauseThresholdBps = _volatilityConfig.pauseThresholdBps;
        lookbackPeriodSeconds = _volatilityConfig.lookbackPeriodSeconds;
        resumeThresholdBps = _volatilityConfig.resumeThresholdBps;
        cooldownSeconds = _volatilityConfig.cooldownSeconds;

        status = MarketStatus.ACTIVE;
    }

    /**
     * @notice LP deposits liquidity (receives initial deposit from factory)
     */
    receive() external payable {
        require(msg.sender == lp || totalLiquidity == 0, "Only LP can add liquidity");
        totalLiquidity += msg.value;
        availableLiquidity += msg.value;
        emit LiquidityDeposited(msg.sender, msg.value);
    }

    /**
     * @notice LP withdraws available liquidity
     */
    function withdrawLiquidity(uint256 amount) external onlyLP nonReentrant {
        require(amount <= availableLiquidity, "Insufficient available liquidity");

        availableLiquidity -= amount;
        totalLiquidity -= amount;

        (bool success, ) = lp.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit LiquidityWithdrawn(lp, amount);
    }

    /**
     * @notice Request a loan (borrower deposits collateral)
     */
    function requestLoan(
        uint256 collateralAmount,  // For ERC20/ERC1155
        uint256 tokenId            // For ERC721
    ) external marketActive nonReentrant returns (uint256 loanId) {

        // Check circuit breaker
        _checkCircuitBreaker();
        require(status == MarketStatus.ACTIVE, "Market paused due to volatility");

        // Get current TWAP price
        uint256 collateralValue = _getCollateralValue(collateralAmount, tokenId);

        // Calculate max loan
        uint256 maxLoan = (collateralValue * ltvBasisPoints) / 10000;
        require(maxLoan > 0, "Collateral value too low");
        require(maxLoan <= availableLiquidity, "Insufficient market liquidity");

        // Create loan
        loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: msg.sender,
            collateralAmount: collateralAmount,
            tokenId: tokenId,
            principal: maxLoan,
            startTime: block.timestamp,
            expiryTime: block.timestamp + durationSeconds,
            status: LoanStatus.ACTIVE
        });

        activeLoanIds.push(loanId);

        // Escrow collateral
        if (assetType == AssetType.ERC20) {
            IERC20(collateralAsset).transferFrom(msg.sender, address(this), collateralAmount);
        } else if (assetType == AssetType.ERC721) {
            IERC721(collateralAsset).transferFrom(msg.sender, address(this), tokenId);
        }
        // ERC1155 handling would go here

        // Update liquidity
        availableLiquidity -= maxLoan;
        totalBorrowed += maxLoan;

        // Transfer loan to borrower
        (bool success, ) = msg.sender.call{value: maxLoan}("");
        require(success, "Loan transfer failed");

        emit LoanCreated(loanId, msg.sender, maxLoan);
    }

    /**
     * @notice Repay a loan
     */
    function repayLoan(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "Not your loan");
        require(loan.status == LoanStatus.ACTIVE || loan.status == LoanStatus.GRACE_PERIOD, "Loan not active");

        uint256 totalDue = calculateTotalDebt(loanId);
        require(msg.value >= totalDue, "Insufficient repayment");

        // Update state
        loan.status = LoanStatus.REPAID;
        availableLiquidity += totalDue;
        totalBorrowed -= loan.principal;

        // Return collateral
        if (assetType == AssetType.ERC20) {
            IERC20(collateralAsset).transfer(msg.sender, loan.collateralAmount);
        } else if (assetType == AssetType.ERC721) {
            IERC721(collateralAsset).transferFrom(address(this), msg.sender, loan.tokenId);
        }

        // Return excess payment
        if (msg.value > totalDue) {
            (bool success, ) = msg.sender.call{value: msg.value - totalDue}("");
            require(success, "Excess refund failed");
        }

        emit LoanRepaid(loanId, totalDue);
    }

    /**
     * @notice Liquidate a loan (callable by anyone after conditions met)
     */
    function liquidateLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE || loan.status == LoanStatus.GRACE_PERIOD, "Loan not active");

        bool canLiquidate = _canLiquidate(loanId);
        require(canLiquidate, "Liquidation conditions not met");

        uint256 recoveryAmount;

        if (assetType == AssetType.ERC20) {
            recoveryAmount = _liquidateERC20(loanId);
        } else if (assetType == AssetType.ERC721) {
            recoveryAmount = _liquidateERC721(loanId);
        }

        loan.status = LoanStatus.LIQUIDATED;
        totalBorrowed -= loan.principal;

        emit LoanLiquidated(loanId, recoveryAmount);
    }

    /**
     * @notice Get TWAP price from Uniswap V3
     */
    function getTWAPPrice() public view returns (uint256) {
        if (oracleType == OracleType.UNISWAP_V3_TWAP) {
            (int24 arithmeticMeanTick, ) = OracleLibrary.consult(
                primaryOracle,
                twapPeriodSeconds
            );

            uint256 price = OracleLibrary.getQuoteAtTick(
                arithmeticMeanTick,
                uint128(1e18), // 1 token
                collateralAsset,
                address(0) // WETH or quote token
            );

            return price;
        }

        // Chainlink implementation would go here
        revert("Oracle type not supported");
    }

    /**
     * @notice Check circuit breaker and pause if needed
     */
    function _checkCircuitBreaker() internal {
        if (!circuitBreakerEnabled) return;

        uint256 currentPrice = getTWAPPrice();
        uint256 historicalPrice = _getHistoricalPrice(lookbackPeriodSeconds);

        uint256 priceChange = currentPrice > historicalPrice
            ? ((currentPrice - historicalPrice) * 10000) / historicalPrice
            : ((historicalPrice - currentPrice) * 10000) / historicalPrice;

        // Check if should pause
        if (priceChange >= pauseThresholdBps && status == MarketStatus.ACTIVE) {
            status = MarketStatus.PAUSED_VOLATILITY;
            pausedAt = block.timestamp;
            emit CircuitBreakerTriggered(priceChange, block.timestamp);
        }

        // Check if should resume
        if (status == MarketStatus.PAUSED_VOLATILITY) {
            bool cooldownPassed = block.timestamp >= pausedAt + cooldownSeconds;
            bool volatilityLow = priceChange < resumeThresholdBps;

            if (cooldownPassed && volatilityLow) {
                status = MarketStatus.ACTIVE;
                emit MarketResumed(block.timestamp);
            }
        }
    }

    /**
     * @notice Calculate total debt (principal + interest)
     */
    function calculateTotalDebt(uint256 loanId) public view returns (uint256) {
        Loan memory loan = loans[loanId];

        uint256 timeElapsed = block.timestamp - loan.startTime;
        uint256 interest = (loan.principal * aprBasisPoints * timeElapsed) / (10000 * 365 days);

        return loan.principal + interest;
    }

    /**
     * @notice Check if loan can be liquidated
     */
    function _canLiquidate(uint256 loanId) internal view returns (bool) {
        Loan memory loan = loans[loanId];

        // Check grace period expiry
        if (loan.status == LoanStatus.GRACE_PERIOD) {
            return block.timestamp > loan.expiryTime + (gracePeriodHours * 1 hours);
        }

        // Check loan expiry
        if (block.timestamp > loan.expiryTime) {
            return true;
        }

        // Check health factor (if enabled)
        if (enableHealthFactor) {
            uint256 collateralValue = _getCollateralValue(loan.collateralAmount, loan.tokenId);
            uint256 debt = calculateTotalDebt(loanId);
            uint256 healthFactor = (collateralValue * 10000) / debt;

            return healthFactor < healthFactorThreshold;
        }

        return false;
    }

    /**
     * @notice Liquidate ERC20 collateral (gradual liquidation)
     */
    function _liquidateERC20(uint256 loanId) internal returns (uint256) {
        Loan memory loan = loans[loanId];
        uint256 totalDebt = calculateTotalDebt(loanId);
        uint256 collateralValue = _getCollateralValue(loan.collateralAmount, 0);

        if (collateralValue <= totalDebt) {
            // Full liquidation
            IERC20(collateralAsset).transfer(lp, loan.collateralAmount);
            return collateralValue;
        } else {
            // Gradual liquidation: take only what's needed
            uint256 tokenPrice = getTWAPPrice();
            uint256 tokensNeeded = (totalDebt * 1e18) / tokenPrice;
            uint256 surplus = loan.collateralAmount - tokensNeeded;

            IERC20(collateralAsset).transfer(lp, tokensNeeded);
            IERC20(collateralAsset).transfer(loan.borrower, surplus);

            return totalDebt;
        }
    }

    /**
     * @notice Liquidate ERC721 collateral
     */
    function _liquidateERC721(uint256 loanId) internal returns (uint256) {
        Loan memory loan = loans[loanId];
        uint256 totalDebt = calculateTotalDebt(loanId);
        uint256 nftValue = _getCollateralValue(0, loan.tokenId);

        // Transfer NFT to LP
        IERC721(collateralAsset).transferFrom(address(this), lp, loan.tokenId);

        // If NFT value > debt, LP must pay surplus to borrower
        if (nftValue > totalDebt) {
            uint256 surplus = nftValue - totalDebt;
            availableLiquidity -= surplus; // LP pays from their liquidity
            (bool success, ) = loan.borrower.call{value: surplus}("");
            require(success, "Surplus payment failed");
        }

        return nftValue > totalDebt ? totalDebt : nftValue;
    }

    function _getCollateralValue(uint256 amount, uint256 tokenId) internal view returns (uint256) {
        if (assetType == AssetType.ERC20) {
            uint256 price = getTWAPPrice();
            return (amount * price) / 1e18;
        } else if (assetType == AssetType.ERC721) {
            // Get floor price from oracle
            // Implementation depends on NFT oracle choice
            return 0; // Placeholder
        }
        return 0;
    }

    function _getHistoricalPrice(uint256 secondsAgo) internal view returns (uint256) {
        // Implementation to get price from secondsAgo timestamp
        // For Uniswap V3, this uses the observe() function
        return 0; // Placeholder
    }
}
```

**Design Rationale**:

1. **Why immutable parameters?**
   - Gas savings (no SLOAD, uses bytecode)
   - Trust (LP can't change terms after borrowers commit)
   - Security (reduces attack surface)

2. **Why TWAP over spot price?**
   - Flash loan immunity (manipulation requires sustained attack)
   - Fairer liquidations (no temporary wick liquidations)
   - Industry standard (Aave, Compound use similar)

3. **Why gradual liquidation for ERC20?**
   - Fairer to borrowers (keep surplus)
   - Better optics (platform not predatory)
   - Still protects LP (gets full debt)

---

## Oracle & Price Feed System

### Why Uniswap V3 TWAP (Primary Choice)

**Chosen over Chainlink for these reasons:**

| Factor               | Uniswap V3 TWAP              | Chainlink                |
| -------------------- | ---------------------------- | ------------------------ |
| **Coverage**         | Any token with DEX liquidity | Only whitelisted feeds   |
| **Decentralization** | Fully on-chain               | Centralized oracle nodes |

|

Manipulation Resistance | Time-weighted (30min) | Update frequency (1hr+) | | Freshness | Always current | Can be stale | | Cost | Free (on-chain data) | Subscription fees | | Long-tail assets | ✅ Supports | ❌ Doesn't support |
Decision: Use Uniswap V3 TWAP as primary, Chainlink as fallback for assets without DEX liquidity.
TWAP Implementation Guide
// Required imports
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol';

contract TWAPOracle {
address public immutable pool; // Uniswap V3 pool address
address public immutable token0;
address public immutable token1;
uint32 public constant TWAP_PERIOD = 1800; // 30 minutes

    constructor(address _pool) {
        pool = _pool;
        token0 = IUniswapV3Pool(_pool).token0();
        token1 = IUniswapV3Pool(_pool).token1();
    }

    /**
     * @notice Get TWAP price for exact period
     * @return price Price of token0 in terms of token1 (scaled by 1e18)
     */
    function getTWAP() external view returns (uint256 price) {
        // Get arithmetic mean tick over TWAP_PERIOD
        (int24 arithmeticMeanTick, ) = OracleLibrary.consult(
            pool,
            TWAP_PERIOD
        );

        // Convert tick to price
        price = OracleLibrary.getQuoteAtTick(
            arithmeticMeanTick,
            uint128(1e18), // Amount in (1 token)
            token0,
            token1
        );
    }

    /**
     * @notice Check if TWAP is available (pool has enough observations)
     */
    function isTWAPAvailable() external view returns (bool) {
        IUniswapV3Pool poolContract = IUniswapV3Pool(pool);

        // Check if pool has observations for our TWAP period
        // Uniswap V3 stores up to 65536 observations
        (, , uint16 observationIndex, uint16 observationCardinality, , , ) = poolContract.slot0();

        // Need at least 2 observations and enough time has passed
        return observationCardinality >= 2;
    }

    /**
     * @notice Get TWAP with deviation check (security)
     * @return price TWAP price
     * @return isValid True if price deviation is acceptable
     */
    function getTWAPWithValidation() external view returns (uint256 price, bool isValid) {
        price = this.getTWAP();

        // Get current spot price for comparison
        (uint160 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(pool).slot0();
        uint256 spotPrice = _sqrtPriceToPrice(sqrtPriceX96);

        // Check deviation (if spot deviates >50% from TWAP, flag as suspicious)
        uint256 deviation = spotPrice > price
            ? ((spotPrice - price) * 100) / price
            : ((price - spotPrice) * 100) / price;

        isValid = deviation < 50; // 50% max deviation
    }

    function _sqrtPriceToPrice(uint160 sqrtPriceX96) internal pure returns (uint256) {
        uint256 price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96) * 1e18) >> 192;
        return price;
    }

}

TWAP Period Selection
Guideline for LPs:
Asset Volatility => TWAP Period

Stablecoins (USDC, DAI):
├─ Volatility: <1% daily
├─ TWAP Period: 10 minutes
└─ Rationale: Low risk, can be shorter

Blue-chip tokens (ETH, BTC):
├─ Volatility: 5-10% daily
├─ TWAP Period: 20 minutes
└─ Rationale: Standard period

Volatile tokens (memes, gaming):
├─ Volatility: 20-50% daily
├─ TWAP Period: 30 minutes
└─ Rationale: Maximum manipulation resistance

NFTs:
├─ Volatility: Varies widely
├─ TWAP Period: N/A (use floor price from Reservoir/Blur)
└─ Rationale: NFTs use different oracle

Fallback Oracle (Chainlink)
For assets without Uniswap V3 pools:
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract ChainlinkOracle {
AggregatorV3Interface public priceFeed;

    constructor(address _priceFeed) {
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function getLatestPrice() public view returns (uint256) {
        (
            ,
            int256 price,
            ,
            uint256 updatedAt,

        ) = priceFeed.latestRoundData();

        require(price > 0, "Invalid price");
        require(block.timestamp - updatedAt < 3600, "Price stale (>1hr)");

        return uint256(price);
    }

}

Liquidation Mechanisms
Two-Tier Liquidation System
Tier 1: Time-Based (Always Active)
Loan expires → Grace period starts
Grace period expires → Liquidation allowed
Tier 2: Health Factor (Optional, LP Enabled)
Collateral value / Debt < Threshold → Liquidation allowed
Even before expiry
Implementation Flow
Liquidation Decision Tree:

Is health factor enabled?
├─ YES:
│ ├─ Health factor < threshold? → LIQUIDATE NOW
│ └─ Health factor OK:
│ ├─ Loan expired? → Start grace period
│ └─ Grace expired? → LIQUIDATE
│
└─ NO:
├─ Loan expired? → Start grace period
└─ Grace expired? → LIQUIDATE

Asset-Specific Liquidation
ERC20 Tokens (Gradual):
function liquidateERC20(uint256 loanId) internal returns (uint256 recovered) {
Loan memory loan = loans[loanId];
uint256 debt = calculateTotalDebt(loanId);
uint256 collateralValue = getCollateralValue(loan.collateralAmount);

    if (collateralValue <= debt) {
        // Underwater: LP takes all collateral
        IERC20(collateralAsset).transfer(lp, loan.collateralAmount);
        recovered = collateralValue;
    } else {
        // Sufficient collateral: Take only what's needed
        uint256 tokenPrice = getTWAP();
        uint256 tokensForDebt = (debt * 1e18) / tokenPrice;
        uint256 surplusTokens = loan.collateralAmount - tokensForDebt;

        // LP gets tokens covering debt
        IERC20(collateralAsset).transfer(lp, tokensForDebt);

        // Borrower gets surplus
        IERC20(collateralAsset).transfer(loan.borrower, surplusTokens);

        recovered = debt;
    }

}

ERC721 NFTs:
function liquidateERC721(uint256 loanId) internal returns (uint256 recovered) {
Loan memory loan = loans[loanId];
uint256 debt = calculateTotalDebt(loanId);
uint256 nftFloorPrice = getNFTFloorPrice(loan.tokenId);

    // Transfer NFT to LP
    IERC721(collateralAsset).safeTransferFrom(address(this), lp, loan.tokenId);

    // LP must pay surplus in ETH if NFT value > debt
    if (nftFloorPrice > debt) {
        uint256 surplus = nftFloorPrice - debt;

        // Deduct from LP's available liquidity
        require(availableLiquidity >= surplus, "LP insufficient funds for surplus");
        availableLiquidity -= surplus;

        // Pay borrower
        (bool success, ) = loan.borrower.call{value: surplus}("");
        require(success, "Surplus payment failed");

        recovered = debt;
    } else {
        recovered = nftFloorPrice;
    }

}

Security Systems

1.  Circuit Breaker System
    Purpose: Prevent new loans during extreme volatility to protect LP from cascade failures.
    contract CircuitBreaker {

        struct VolatilitySnapshot {
            uint256 price;
            uint256 timestamp;
        }

        VolatilitySnapshot[] public priceHistory;
        uint256 public constant MAX_HISTORY = 100;

        /**
         * @notice Update price history (called by keeper bot every minute)
         */
        function updatePriceHistory() external {
            uint256 currentPrice = getTWAP();

            priceHistory.push(VolatilitySnapshot({
                price: currentPrice,
                timestamp: block.timestamp
            }));

            // Keep last 100 data points (efficient circular buffer in production)
            if (priceHistory.length > MAX_HISTORY) {
                _shiftArray();
            }
        }

        /**
         * @notice Calculate volatility over lookback period
         */
        function calculateVolatility(uint256 lookbackSeconds) public view returns (uint256) {
            require(priceHistory.length >= 2, "Insufficient data");

            uint256 cutoffTime = block.timestamp - lookbackSeconds;
            uint256 oldestPrice = 0;
            uint256 newestPrice = priceHistory[priceHistory.length - 1].price;

            // Find price at cutoff time
            for (uint i = priceHistory.length; i > 0; i--) {
                if (priceHistory[i - 1].timestamp <= cutoffTime) {
                    oldestPrice = priceHistory[i - 1].price;
                    break;
                }
            }

            require(oldestPrice > 0, "No data for lookback period");

            // Calculate % change
            uint256 change = newestPrice > oldestPrice
                ? ((newestPrice - oldestPrice) * 10000) / oldestPrice
                : ((oldestPrice - newestPrice) * 10000) / oldestPrice;

            return change; // Returns basis points (2000 = 20%)
        }

        /**
         * @notice Check if should trigger circuit breaker
         */
        function shouldPause() public view returns (bool) {
            if (!circuitBreakerEnabled) return false;
            if (status != MarketStatus.ACTIVE) return false;

            uint256 volatility = calculateVolatility(lookbackPeriodSeconds);
            return volatility >= pauseThresholdBps;
        }

        /**
         * @notice Check if should resume after pause
         */
        function shouldResume() public view returns (bool) {
            if (status != MarketStatus.PAUSED_VOLATILITY) return false;

            // Check cooldown period
            if (block.timestamp < pausedAt + cooldownSeconds) return false;

            // Check if volatility has decreased
            uint256 volatility = calculateVolatility(lookbackPeriodSeconds);
            return volatility < resumeThresholdBps;
        }

    }

2.  Reentrancy Protection
    All state-changing functions use OpenZeppelin's ReentrancyGuard:
    import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LendingMarket is ReentrancyGuard {

    function requestLoan(...) external nonReentrant {
        // Safe from reentrancy
    }

    function repayLoan(...) external payable nonReentrant {
        // Safe from reentrancy
    }

    function liquidateLoan(...) external nonReentrant {
        // Safe from reentrancy
    }

}

Critical: Always follow Checks-Effects-Interactions pattern:
function repayLoan(uint256 loanId) external payable nonReentrant {
// 1. CHECKS
Loan storage loan = loans[loanId];
require(loan.borrower == msg.sender, "Not your loan");
require(loan.status == LoanStatus.ACTIVE, "Not active");

    uint256 totalDue = calculateTotalDebt(loanId);
    require(msg.value >= totalDue, "Insufficient payment");

    // 2. EFFECTS (update state BEFORE external calls)
    loan.status = LoanStatus.REPAID;
    availableLiquidity += totalDue;
    totalBorrowed -= loan.principal;

    // 3. INTERACTIONS (external calls LAST)
    IERC20(collateralAsset).transfer(msg.sender, loan.collateralAmount);

    if (msg.value > totalDue) {
        (bool success, ) = msg.sender.call{value: msg.value - totalDue}("");
        require(success, "Refund failed");
    }

}

3. Integer Overflow Protection
   Use Solidity 0.8.x built-in overflow checks (enabled by default):
   pragma solidity ^0.8.20; // Automatic overflow protection

// These operations automatically revert on overflow:
uint256 result = a + b; // Reverts if overflows
uint256 result = a \* b; // Reverts if overflows

For unchecked math (when overflow is impossible), use unchecked{}:
function calculateInterest(uint256 principal, uint256 apr, uint256 time) internal pure returns (uint256) {
unchecked {
// Safe because: principal _ apr _ time will never overflow uint256
// for realistic loan parameters (principal < 10000 ETH, apr < 100%, time < 1 year)
return (principal _ apr _ time) / (10000 \* 365 days);
}
}

Multi-Chain Infrastructure
EVM Chains (Ethereum, Polygon, Base, Arbitrum, Optimism)
Deployment Strategy: Identical contracts on all EVM chains.
// Hardhat deployment script
const deployToChain = async (chainName) => {
console.log(`Deploying to ${chainName}...`);

// Deploy MarketFactory
const MarketFactory = await ethers.getContractFactory("MarketFactory");
const factory = await MarketFactory.deploy(
protocolTreasury // Same treasury on all chains
);
await factory.deployed();

console.log(`MarketFactory deployed to: ${factory.address}`);

// Verify on Etherscan (or equivalent)
if (chainName !== "localhost") {
await hre.run("verify:verify", {
address: factory.address,
constructorArguments: [protocolTreasury],
});
}
};

// Deploy to all chains
const chains = ["ethereum", "polygon", "base", "arbitrum", "optimism"];
for (const chain of chains) {
await deployToChain(chain);
}

Chain-Specific Considerations:
Chain
Gas Token
Block Time
Oracle Availability
Notes
Ethereum
ETH
~12s
Excellent (Uniswap V3, Chainlink)
Highest security, highest cost
Polygon
MATIC
~2s
Good (QuickSwap, Chainlink)
Fast, cheap, good for gaming
Base
ETH
~2s
Growing (Uniswap V3)
New, Coinbase-backed
Arbitrum
ETH
~0.25s
Excellent (Uniswap V3, Chainlink)
L2, cheap, fast
Optimism
ETH
~2s
Good (Uniswap V3, Chainlink)
L2, cheap, OP Stack

Solana (SVM)
Use Anchor framework (Solana's equivalent of Hardhat):
// programs/red-chips/src/lib.rs
use anchor_lang::prelude::\*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("OpenAsset MarketXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod red_chips {
use super::\*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        ltv_basis_points: u16,
        apr_basis_points: u16,
        duration_seconds: i64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.lp = ctx.accounts.lp.key();
        market.collateral_mint = ctx.accounts.collateral_mint.key();
        market.ltv_basis_points = ltv_basis_points;
        market.apr_basis_points = apr_basis_points;
        market.duration_seconds = duration_seconds;
        market.total_liquidity = 0;
        market.available_liquidity = 0;

        Ok(())
    }

    pub fn request_loan(
        ctx: Context<RequestLoan>,
        collateral_amount: u64,
    ) -> Result<()> {
        // Implementation similar to Solidity version
        Ok(())
    }

}

#[derive(Accounts)]
pub struct CreateMarket<'info> { #[account(
init,
payer = lp,
space = 8 + Market::SIZE
)]
pub market: Account<'info, Market>,

    #[account(mut)]
    pub lp: Signer<'info>,

    pub collateral_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,

}

#[account]
pub struct Market {
pub lp: Pubkey,
pub collateral_mint: Pubkey,
pub ltv_basis_points: u16,
pub apr_basis_points: u16,
pub duration_seconds: i64,
pub total_liquidity: u64,
pub available_liquidity: u64,
}

impl Market {
pub const SIZE: usize = 32 + 32 + 2 + 2 + 8 + 8 + 8;
}

Solana-Specific Oracles:
Pyth Network: Primary choice (real-time price feeds)
Switchboard: Secondary option
use pyth_sdk_solana::load_price_feed_from_account_info;

pub fn get_twap_price(price_account: &AccountInfo) -> Result<u64> {
let price_feed = load_price_feed_from_account_info(price_account)?;
let price = price_feed.get_current_price().unwrap();

    Ok(price.price as u64)

}

Data Models
On-Chain Data Structures
struct Loan {
address borrower; // 20 bytes
uint256 collateralAmount; // 32 bytes (for ERC20/ERC1155)
uint256 tokenId; // 32 bytes (for ERC721)
uint256 principal; // 32 bytes
uint256 startTime; // 32 bytes
uint256 expiryTime; // 32 bytes
LoanStatus status; // 1 byte (enum)
}
// Total: ~181 bytes per loan

struct MarketConfig {
address lpAddress; // 20 bytes
address collateralAsset; // 20 bytes
AssetType assetType; // 1 byte
uint256 ltvBasisPoints; // 32 bytes
uint256 aprBasisPoints; // 32 bytes
uint256 durationSeconds; // 32 bytes
// ... more fields
}

Off-Chain Database Schema (PostgreSQL)
-- Markets table
CREATE TABLE markets (
id SERIAL PRIMARY KEY,
contract_address VARCHAR(42) UNIQUE NOT NULL,
chain_id INTEGER NOT NULL,
lp_address VARCHAR(42) NOT NULL,
collateral_asset VARCHAR(42) NOT NULL,
asset_type VARCHAR(20) NOT NULL,
ltv_bps INTEGER NOT NULL,
apr_bps INTEGER NOT NULL,
total_liquidity DECIMAL(30, 18),
available_liquidity DECIMAL(30, 18),
status VARCHAR(20) DEFAULT 'ACTIVE',
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_markets_lp ON markets(lp_address);
CREATE INDEX idx_markets_asset ON markets(collateral_asset);
CREATE INDEX idx_markets_chain ON markets(chain_id);

-- Loans table
CREATE TABLE loans (
id SERIAL PRIMARY KEY,
loan_id_onchain INTEGER NOT NULL,
market_address VARCHAR(42) NOT NULL,
borrower_address VARCHAR(42) NOT NULL,
collateral_amount DECIMAL(30, 18),
token_id BIGINT,
principal DECIMAL(30, 18) NOT NULL,
start_time TIMESTAMP NOT NULL,
expiry_time TIMESTAMP NOT NULL,
status VARCHAR(20) DEFAULT 'ACTIVE',
health_factor DECIMAL(10, 2),
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW(),
UNIQUE(market_address, loan_id_onchain)
);

CREATE INDEX idx_loans_borrower ON loans(borrower_address);
CREATE INDEX idx_loans_market ON loans(market_address);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_health ON loans(health_factor) WHERE status = 'ACTIVE';

-- Price history (for TWAP calculation)
CREATE TABLE price_history (
id SERIAL PRIMARY KEY,
asset_address VARCHAR(42) NOT NULL,
chain_id INTEGER NOT NULL,
price DECIMAL(30, 18) NOT NULL,
source VARCHAR(50) NOT NULL, -- 'UNISWAP_V3', 'CHAINLINK', etc.
timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_price_asset_time ON price_history(asset_address, timestamp DESC);

-- Alert history
CREATE TABLE alerts (
id SERIAL PRIMARY KEY,
loan_id INTEGER REFERENCES loans(id),
alert_type VARCHAR(50) NOT NULL, -- 'WATCH', 'WARNING', 'CRITICAL'
health_factor DECIMAL(10, 2),
message TEXT,
sent_via VARCHAR(50)[], -- ['email', 'sms', 'push']
created_at TIMESTAMP DEFAULT NOW()
);

Integration Patterns
Frontend Integration (React + Web3)
// hooks/useLendingMarket.ts
import { useContract, useContractRead, useContractWrite } from 'wagmi';
import LendingMarketABI from '../abis/LendingMarket.json';

export const useLendingMarket = (marketAddress: string) => {

// Read market state
const { data: totalLiquidity } = useContractRead({
address: marketAddress,
abi: LendingMarketABI,
functionName: 'totalLiquidity',
});

const { data: availableLiquidity } = useContractRead({
address: marketAddress,
abi: LendingMarketABI,
functionName: 'availableLiquidity',
});

// Write: Request loan
const { write: requestLoan, isLoading } = useContractWrite({
address: marketAddress,
abi: LendingMarketABI,
functionName: 'requestLoan',
});

const takeLoan = async (collateralAmount: bigint) => {
return requestLoan({
args: [collateralAmount, 0], // 0 for tokenId (ERC20)
});
};

return {
totalLiquidity,
availableLiquidity,
takeLoan,
isLoading,
};
};

Backend Integration (Node.js + Ethers.js)
// services/healthMonitor.js
const { ethers } = require('ethers');
const LendingMarketABI = require('../abis/LendingMarket.json');

class HealthMonitor {
constructor(provider, marketAddress) {
this.provider = provider;
this.market = new ethers.Contract(marketAddress, LendingMarketABI, provider);
}

async monitorActiveLoans() {
// Get all active loans
const activeLoanIds = await this.market.activeLoanIds();

    for (const loanId of activeLoanIds) {
      const loan = await this.market.loans(loanId);
      const debt = await this.market.calculateTotalDebt(loanId);
      const collateralValue = await this._getCollateralValue(loan);

      const healthFactor = (collateralValue * 10000) / debt;

      // Update database
      await this.updateLoanHealth(loanId, healthFactor);

      // Send alerts if needed
      if (healthFactor < 140) {
        await this.sendAlert(loan.borrower, loanId, healthFactor);
      }
    }

}

async updateLoanHealth(loanId, healthFactor) {
await db.query(
'UPDATE loans SET health_factor = $1, updated_at = NOW() WHERE loan_id_onchain = $2',
[healthFactor / 100, loanId]
);
}

async sendAlert(borrower, loanId, healthFactor) {
// Implementation depends on alert service
}
}

module.exports = HealthMonitor;

Testing Strategy
Unit Tests (Hardhat)
// test/LendingMarket.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingMarket", function () {

let market, collateralToken, lp, borrower;

beforeEach(async function () {
[lp, borrower] = await ethers.getSigners();

    // Deploy mock ERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    collateralToken = await MockERC20.deploy("Mock Token", "MTK");

    // Deploy market
    const LendingMarket = await ethers.getContractFactory("LendingMarket");
    market = await LendingMarket.deploy(
      lp.address,
      collateralToken.address,
      0, // AssetType.ERC20
      7000, // 70% LTV
      1200, // 12% APR
      30 * 24 * 3600, // 30 days
      72, // 72h grace period
      true, // Enable health factor
      12000, // 120% threshold
      // ... oracle and volatility configs
    );

    // Fund market
    await lp.sendTransaction({
      to: market.address,
      value: ethers.utils.parseEther("10")
    });

});

it("Should create a loan with correct parameters", async function () {
const collateralAmount = ethers.utils.parseEther("1000");

    // Mint and approve collateral
    await collateralToken.mint(borrower.address, collateralAmount);
    await collateralToken.connect(borrower).approve(market.address, collateralAmount);

    // Request loan
    await market.connect(borrower).requestLoan(collateralAmount, 0);

    // Verify loan created
    const loan = await market.loans(0);
    expect(loan.borrower).to.equal(borrower.address);
    expect(loan.collateralAmount).to.equal(collateralAmount);

});

it("Should prevent loans when circuit breaker triggered", async function () {
// Trigger circuit breaker by simulating volatility
// ... implementation

    await expect(
      market.connect(borrower).requestLoan(ethers.utils.parseEther("1000"), 0)
    ).to.be.revertedWith("Market paused due to volatility");

});

it("Should liquidate loan after grace period", async function () {
// Create loan
// ...

    // Fast forward past expiry + grace period
    await ethers.provider.send("evm_increaseTime", [32 * 24 * 3600]); // 32 days
    await ethers.provider.send("evm_mine");

    // Liquidate
    await market.liquidateLoan(0);

    const loan = await market.loans(0);
    expect(loan.status).to.equal(2); // LIQUIDATED

});
});

Security Checklist
Before mainnet deployment, verify:
[ ] All contracts audited by 2+ firms (Consensys Diligence, Trail of Bits, OpenZeppelin)
[ ] ReentrancyGuard on all state-changing functions
[ ] Checks-Effects-Interactions pattern followed
[ ] Integer overflow protection (Solidity 0.8.x)
[ ] TWAP oracle implemented correctly
[ ] Circuit breaker tested under extreme volatility
[ ] Gradual liquidation tested for edge cases
[ ] Access control (onlyLP, onlyOwner) verified
[ ] Emergency pause mechanism tested
[ ] Multisig for protocol treasury (3-of-5)
[ ] Time lock for protocol upgrades (if upgradeable)
[ ] Bug bounty program active (Immunefi)
[ ] Comprehensive test coverage (>90%)
[ ] Mainnet deployment checklist completed
[ ] Incident response plan documented

Gas Optimization Notes
Critical optimizations implemented:
Use immutable for constants: Saves ~2100 gas per read
Pack structs efficiently: Align to 32-byte boundaries
Use events instead of storage: 375 gas vs 20,000+ gas
Batch operations: Single transaction vs multiple
Use unchecked{} for safe math: Saves ~200 gas per operation
Example:
// BAD: Uses storage (20,000 gas)
mapping(uint256 => uint256) public loanCreationTimes;

// GOOD: Use events (375 gas)
event LoanCreated(uint256 indexed loanId, uint256 timestamp);
// Query events off-chain via The Graph
