// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "./libraries/UniswapV3TWAPOracle.sol";
import "./libraries/ChainlinkOracle.sol";
import "./libraries/CircuitBreaker.sol";
import "./libraries/AssetHandler.sol";
import "./interfaces/ILendingMarket.sol";
import "./interfaces/ILoanContract.sol";
import {OracleType, INFTOracle} from "./interfaces/IOracle.sol";
import {AssetType} from "./interfaces/IMarketFactory.sol";

/**
 * @title LPToken
 * @notice ERC20 token representing liquidity provider shares
 */
contract LPToken is ERC20 {
    address public immutable market;
    
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        market = msg.sender;
    }
    
    function mint(address to, uint256 amount) external {
        require(msg.sender == market, "Only market");
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external {
        require(msg.sender == market, "Only market");
        _burn(from, amount);
    }
}

/**
 * @title LendingMarket
 * @notice Isolated lending market with multi-asset support and circuit breaker
 * @dev Production-grade implementation with Uniswap V3 TWAP and Chainlink fallback
 * 
 * Key Features:
 * - LP share-based liquidity management
 * - Deploys isolated LoanContract per loan (minimal proxy)
 * - Uniswap V3 TWAP primary oracle + Chainlink fallback
 * - Circuit breaker with on-chain volatility tracking
 * - Multi-asset support (ERC20/721/1155)
 * - Revenue sharing (90% LP, 10% protocol)
 * - Comprehensive loan registry
 * 
 * @custom:security-contact security@redchips.io
 */
contract LendingMarket is ILendingMarket, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using UniswapV3TWAPOracle for UniswapV3TWAPOracle.TWAPConfig;
    using CircuitBreaker for CircuitBreaker.CircuitBreakerState;
    using AssetHandler for AssetHandler.AssetType;
    
    // ============ Constants ============
    
    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant ORIGINATION_FEE_BPS = 50; // 0.5%
    uint256 private constant REVENUE_SHARE_PROTOCOL_BPS = 1000; // 10%
    uint256 private constant INITIAL_SHARES_PER_TOKEN = 1e18;
    
    // ============ Immutable Configuration ============
    
    address public immutable factory;
    address public immutable marketOwner;
    address public immutable collateralAsset;
    IERC20 public immutable loanAsset;
    address public immutable protocolTreasury;
    address public immutable loanImplementation; // For minimal proxy
    LPToken public immutable lpToken;
    
    AssetType public immutable assetType;
    OracleType public immutable oracleType;
    
    uint256 public immutable ltvBps;
    uint256 public immutable aprBps;
    uint256 public immutable durationSeconds;
    uint256 public immutable healthFactorThreshold;
    
    // Oracle configuration
    address public immutable primaryOracle; // Uniswap pool or Chainlink feed
    address public immutable nftOracle; // For NFT collateral
    UniswapV3TWAPOracle.TWAPConfig public twapConfig;
    
    // Circuit breaker configuration
    CircuitBreaker.CircuitBreakerConfig public circuitBreakerConfig;
    
    // ============ Mutable State ============
    
    uint256 public totalLiquidity;
    uint256 public reservedLiquidity; // Locked in active loans
    
    // Loan registry
    address[] public allLoans;
    mapping(address => bool) public isLoan;
    mapping(address => uint256) public loanIndex; // For efficient removal
    
    // Circuit breaker state
    CircuitBreaker.CircuitBreakerState private circuitBreakerState;
    
    // ============ Events ============
    
    event LiquidityDeposited(address indexed provider, uint256 amount, uint256 shares);
    event LiquidityWithdrawn(address indexed provider, uint256 amount, uint256 shares);
    event LoanCreated(address indexed loanContract, address indexed borrower, uint256 principal);
    event CircuitBreakerTriggered(uint256 volatility, uint256 timestamp);
    event CircuitBreakerReset(uint256 timestamp);
    event OriginationFeePaid(address indexed treasury, uint256 amount);
    
    // ============ Errors ============
    
    error OnlyFactory();
    error OnlyMarketOwner();
    error InsufficientLiquidity();
    error InsufficientCollateral();
    error CircuitBreakerActive();
    error InvalidAmount();
    error InvalidOracle();
    error LoanNotFound();
    
    // ============ Modifiers ============
    
    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }
    
    modifier onlyMarketOwner() {
        if (msg.sender != marketOwner) revert OnlyMarketOwner();
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        address marketOwner_,
        address collateralAsset_,
        address loanAsset_,
        address protocolTreasury_,
        address loanImplementation_,
        AssetType assetType_,
        OracleType oracleType_,
        address primaryOracle_,
        address nftOracle_,
        uint256 ltvBps_,
        uint256 aprBps_,
        uint256 durationSeconds_,
        uint256 healthFactorThreshold_,
        CircuitBreaker.CircuitBreakerConfig memory cbConfig_
    ) {
        factory = msg.sender;
        marketOwner = marketOwner_;
        collateralAsset = collateralAsset_;
        loanAsset = IERC20(loanAsset_);
        protocolTreasury = protocolTreasury_;
        loanImplementation = loanImplementation_;
        
        assetType = assetType_;
        oracleType = oracleType_;
        primaryOracle = primaryOracle_;
        nftOracle = nftOracle_;
        
        ltvBps = ltvBps_;
        aprBps = aprBps_;
        durationSeconds = durationSeconds_;
        healthFactorThreshold = healthFactorThreshold_;
        
        circuitBreakerConfig = cbConfig_;
        
        // Initialize TWAP config if using Uniswap V3
        if (oracleType_ == OracleType.UNISWAP_V3_TWAP) {
            twapConfig = UniswapV3TWAPOracle.createTWAPConfig(
                primaryOracle_,
                collateralAsset_,
                loanAsset_,
                UniswapV3TWAPOracle.RECOMMENDED_TWAP_PERIOD
            );
        }
        
        // Deploy LP token
        lpToken = new LPToken("RedChips LP Token", "rcLP");
    }
    
    // ============ Initialization (Called by Factory) ============
    
    /**
     * @notice Initialize market with initial liquidity from creator
     * @param initialLiquidity Amount of loan asset to deposit
     * @return shares LP shares minted to creator
     */
    function initializeWithLiquidity(uint256 initialLiquidity) 
        external 
        onlyFactory 
        returns (uint256 shares) 
    {
        require(totalLiquidity == 0, "Already initialized");
        
        // Pull liquidity from factory (which received it from market creator)
        loanAsset.safeTransferFrom(msg.sender, address(this), initialLiquidity);
        
        // Mint initial shares 1:1 with precision
        shares = initialLiquidity * INITIAL_SHARES_PER_TOKEN / 1e18;
        totalLiquidity = initialLiquidity;
        
        // Mint shares to market owner (creator)
        lpToken.mint(marketOwner, shares);
        
        emit LiquidityDeposited(marketOwner, initialLiquidity, shares);
    }
    
    // ============ LP Functions ============
    
    /**
     * @notice Deposit loan assets to provide liquidity
     * @param amount Amount of loan assets to deposit
     * @return shares Amount of LP shares minted
     */
    function depositLiquidity(uint256 amount) 
        external 
        override
        nonReentrant 
        whenNotPaused 
        returns (uint256 shares) 
    {
        if (amount == 0) revert InvalidAmount();
        
        // Calculate shares to mint
        uint256 totalShares = lpToken.totalSupply();
        
        if (totalShares == 0) {
            shares = amount * INITIAL_SHARES_PER_TOKEN / 1e18;
        } else {
            shares = (amount * totalShares) / totalLiquidity;
        }
        
        if (shares == 0) revert InvalidAmount();
        
        // Update state
        totalLiquidity += amount;
        
        // Pull tokens and mint shares
        loanAsset.safeTransferFrom(msg.sender, address(this), amount);
        lpToken.mint(msg.sender, shares);
        
        emit LiquidityDeposited(msg.sender, amount, shares);
    }
    
    /**
     * @notice Withdraw liquidity by burning LP shares
     * @param shares Amount of LP shares to burn
     * @return amount Amount of loan assets withdrawn
     */
    function withdrawLiquidity(uint256 shares) 
        external 
        override
        nonReentrant 
        returns (uint256 amount) 
    {
        if (shares == 0) revert InvalidAmount();
        
        uint256 totalShares = lpToken.totalSupply();
        amount = (shares * totalLiquidity) / totalShares;
        
        if (amount == 0) revert InvalidAmount();
        
        // Check available liquidity
        uint256 availableLiquidity = totalLiquidity - reservedLiquidity;
        if (amount > availableLiquidity) revert InsufficientLiquidity();
        
        // Update state
        totalLiquidity -= amount;
        
        // Burn shares and transfer tokens
        lpToken.burn(msg.sender, shares);
        loanAsset.safeTransfer(msg.sender, amount);
        
        emit LiquidityWithdrawn(msg.sender, amount, shares);
    }
    
    /**
     * @notice Get available liquidity for new loans
     */
    function getAvailableLiquidity() public view override returns (uint256 available) {
        return totalLiquidity - reservedLiquidity;
    }
    
    // ============ Borrower Functions ============
    
    /**
     * @notice Request a loan by depositing collateral
     * @param collateralAmount Amount of collateral (for ERC20/1155)
     * @param tokenId Token ID (for ERC721)
     * @param erc1155Amount Amount (for ERC1155)
     * @return loanContract Address of created LoanContract
     */
    function requestLoan(
        uint256 collateralAmount,
        uint256 tokenId,
        uint256 erc1155Amount
    ) 
        external 
        override
        nonReentrant 
        whenNotPaused 
        returns (address loanContract) 
    {
        // 1. CHECKS: Circuit breaker
        uint256 currentPrice = getCollateralPrice();
        bool shouldPause = circuitBreakerState.checkAndUpdate(
            circuitBreakerConfig,
            currentPrice
        );
        
        if (shouldPause) {
            emit CircuitBreakerTriggered(
                CircuitBreaker.calculateVolatility(circuitBreakerState, circuitBreakerConfig),
                block.timestamp
            );
            revert CircuitBreakerActive();
        }
        
        // 2. CHECKS: Calculate loan amount
        uint256 collateralValue = _calculateCollateralValue(
            collateralAmount,
            tokenId,
            erc1155Amount,
            currentPrice
        );
        
        uint256 maxLoan = (collateralValue * ltvBps) / BPS_DENOMINATOR;
        if (maxLoan == 0) revert InsufficientCollateral();
        
        uint256 availableLiquidity = getAvailableLiquidity();
        if (maxLoan > availableLiquidity) revert InsufficientLiquidity();
        
        // Calculate origination fee and interest
        uint256 originationFee = (maxLoan * ORIGINATION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netLoan = maxLoan - originationFee;
        uint256 interestAmount = (maxLoan * aprBps) / BPS_DENOMINATOR;
        uint256 expiryTime = block.timestamp + durationSeconds;
        
        // 3. EFFECTS: Deploy loan contract via minimal proxy
        loanContract = Clones.clone(loanImplementation);
        
        // Initialize loan
        ILoanContract(loanContract).initialize(
            msg.sender,
            collateralAmount,
            tokenId,
            erc1155Amount,
            maxLoan,
            interestAmount,
            expiryTime
        );
        
        // Register loan
        allLoans.push(loanContract);
        isLoan[loanContract] = true;
        loanIndex[loanContract] = allLoans.length - 1;
        
        // Reserve liquidity
        reservedLiquidity += maxLoan;
        
        // 4. INTERACTIONS: Transfer collateral from borrower to loan contract
        AssetHandler.transferAsset(
            assetType,
            collateralAsset,
            msg.sender,
            loanContract,
            assetType == AssetType.ERC721 ? tokenId : collateralAmount,
            erc1155Amount
        );
        
        // 5. INTERACTIONS: Transfer loan to borrower and fee to treasury
        loanAsset.safeTransfer(msg.sender, netLoan);
        loanAsset.safeTransfer(protocolTreasury, originationFee);
        
        emit LoanCreated(loanContract, msg.sender, maxLoan);
        emit OriginationFeePaid(protocolTreasury, originationFee);
    }
    
    // ============ Loan Management ============
    
    /**
     * @notice Remove loan from active registry (called after repay/liquidation)
     * @param loanContract Address of loan contract
     */
    function removeLoan(address loanContract, uint256 principal) external {
        require(isLoan[loanContract], "Not a loan");
        require(msg.sender == loanContract, "Only loan itself");
        
        // Free up reserved liquidity
        reservedLiquidity -= principal;
        
        // Remove from registry (swap with last and pop)
        uint256 index = loanIndex[loanContract];
        uint256 lastIndex = allLoans.length - 1;
        
        if (index != lastIndex) {
            address lastLoan = allLoans[lastIndex];
            allLoans[index] = lastLoan;
            loanIndex[lastLoan] = index;
        }
        
        allLoans.pop();
        delete isLoan[loanContract];
        delete loanIndex[loanContract];
    }
    
    // ============ Oracle Functions ============
    
    /**
     * @notice Get current collateral price from oracle
     * @return price Price with 18 decimals
     */
    function getCollateralPrice() public view returns (uint256 price) {
        if (oracleType == OracleType.UNISWAP_V3_TWAP) {
            (price, ) = UniswapV3TWAPOracle.getTWAPPrice(twapConfig);
        } else if (oracleType == OracleType.CHAINLINK) {
            (price, ) = ChainlinkOracle.getPrice(primaryOracle);
        } else if (oracleType == OracleType.NFT_ORACLE) {
            // Use NFT Oracle for floor price
            INFTOracle nftOracleContract = INFTOracle(nftOracle);
            
            // Get floor price in ETH
            uint256 floorPriceETH = nftOracleContract.getFloorPrice(collateralAsset);
            
            // Convert to loan asset terms (assuming loan asset is stablecoin)
            // If loan asset is not USD-pegged, need to convert via price feed
            price = nftOracleContract.getFloorPriceUSD(collateralAsset);
        } else {
            revert InvalidOracle();
        }
    }
    
    /**
     * @notice Calculate collateral value in loan asset terms
     */
    function _calculateCollateralValue(
        uint256 collateralAmount,
        uint256 tokenId,
        uint256 erc1155Amount,
        uint256 price
    ) internal view returns (uint256 value) {
        if (assetType == AssetType.ERC20) {
            value = (collateralAmount * price) / 1e18;
        } else if (assetType == AssetType.ERC721) {
            value = price; // Floor price
        } else {
            value = (erc1155Amount * price) / 1e18;
        }
    }
    
    /**
     * @notice Get historical price for circuit breaker
     * @param secondsAgo How many seconds back to look
     * @return price Historical price with 18 decimals
     */
    function _getHistoricalPrice(uint256 secondsAgo) internal view returns (uint256 price) {
        if (oracleType == OracleType.UNISWAP_V3_TWAP) {
            // Use Uniswap V3 pool's observe() function
            IUniswapV3Pool pool = IUniswapV3Pool(primaryOracle);
            
            // Validate observation cardinality
            (, , , uint16 observationCardinality, , , ) = pool.slot0();
            require(observationCardinality >= 2, "Insufficient observations");
            
            uint32[] memory secondsAgos = new uint32[](2);
            secondsAgos[0] = uint32(secondsAgo);
            secondsAgos[1] = 0; // Now
            
            (int56[] memory tickCumulatives, ) = pool.observe(secondsAgos);
            
            // Calculate time-weighted average tick
            int56 tickCumulativeDelta = tickCumulatives[1] - tickCumulatives[0];
            int24 arithmeticMeanTick = int24(tickCumulativeDelta / int56(int256(secondsAgo)));
            
            // Convert tick to price
            price = OracleLibrary.getQuoteAtTick(
                arithmeticMeanTick,
                uint128(1e18),
                collateralAsset,
                address(loanAsset)
            );
        } else if (oracleType == OracleType.CHAINLINK) {
            // Chainlink doesn't have historical prices on-chain
            // Return current price (circuit breaker will use this as baseline)
            (price, ) = ChainlinkOracle.getPrice(primaryOracle);
        } else {
            // For NFT oracle, use current price
            revert("NFT oracle historical price not available");
        }
    }
    
    // ============ Circuit Breaker ============
    
    /**
     * @notice Check if circuit breaker is triggered
     */
    function isCircuitBreakerTriggered() public view override returns (bool) {
        return circuitBreakerState.isTriggered();
    }
    
    /**
     * @notice Manually trigger circuit breaker (emergency)
     */
    function triggerCircuitBreaker() external onlyMarketOwner {
        circuitBreakerState.isPaused = true;
        circuitBreakerState.pausedAt = block.timestamp;
        emit CircuitBreakerTriggered(0, block.timestamp);
    }
    
    /**
     * @notice Reset circuit breaker (after resolving issue)
     */
    function resetCircuitBreaker() external onlyMarketOwner {
        circuitBreakerState.isPaused = false;
        circuitBreakerState.pausedAt = 0;
        emit CircuitBreakerReset(block.timestamp);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Pause market (emergency)
     */
    function pause() external onlyMarketOwner {
        _pause();
    }
    
    /**
     * @notice Unpause market
     */
    function unpause() external onlyMarketOwner {
        _unpause();
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get loan configuration (called by LoanContract)
     */
    function getLoanConfig() external view returns (
        address collateralAsset_,
        address loanAsset_,
        address protocolTreasury_,
        address oracle_,
        AssetType assetType_,
        uint256 healthFactorThreshold_
    ) {
        return (
            collateralAsset,
            address(loanAsset),
            protocolTreasury,
            primaryOracle,
            assetType,
            healthFactorThreshold
        );
    }
    
    /**
     * @notice Get all active loans
     */
    function getAllLoans() external view returns (address[] memory) {
        return allLoans;
    }
    
    /**
     * @notice Get market statistics
     */
    function getMarketStats() external view returns (
        uint256 totalLiq,
        uint256 reservedLiq,
        uint256 availableLiq,
        uint256 totalShares,
        uint256 utilizationRate,
        uint256 activeLoanCount,
        bool cbTriggered
    ) {
        totalLiq = totalLiquidity;
        reservedLiq = reservedLiquidity;
        availableLiq = getAvailableLiquidity();
        totalShares = lpToken.totalSupply();
        utilizationRate = totalLiquidity > 0 
            ? (reservedLiquidity * BPS_DENOMINATOR) / totalLiquidity 
            : 0;
        activeLoanCount = allLoans.length;
        cbTriggered = isCircuitBreakerTriggered();
    }
}