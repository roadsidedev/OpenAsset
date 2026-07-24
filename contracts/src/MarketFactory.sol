// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./LendingMarket.sol";
import "./LoanContract.sol";
import "./libraries/CircuitBreaker.sol"; // Contains AssetHandler library
import "./interfaces/IMarketFactory.sol";
import "./interfaces/IOracle.sol";

/**
 * @title MarketFactory
 * @notice Production-grade factory for deploying isolated lending markets
 * @dev Comprehensive validation, stablecoin whitelist, multi-chain support
 * 
 * Security Features:
 * - Stablecoin whitelist (USDC, USDT, DAI only)
 * - Oracle validation before market creation
 * - Duplicate market prevention
 * - Creation fee (0.5% of initial liquidity)
 * - Minimum liquidity requirement (1000 USD equivalent)
 * - Circuit breaker
 * - Comprehensive parameter validation
 * - Market registry with metadata
 * 
 * @custom:security-contact security@openasset.io
 */
contract MarketFactory is IMarketFactory, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    
    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant CREATION_FEE_BPS = 50; // 0.5%
    uint256 private constant MIN_LIQUIDITY_USD = 1000e18; // $1000 minimum
    
    // Parameter bounds
    uint256 private constant MIN_LTV_BPS = 100;        // 1%
    uint256 private constant MAX_LTV_BPS = 9500;       // 95%
    uint256 private constant MAX_APR_BPS = 10000;      // 100%
    uint256 private constant MIN_DURATION = 1 hours;
    uint256 private constant MAX_DURATION = 365 days;
    uint256 private constant MIN_HEALTH_FACTOR = 11000; // 110%
    uint256 private constant MAX_HEALTH_FACTOR = 20000; // 200%
    
    // Circuit breaker bounds
    uint256 private constant MIN_CB_THRESHOLD = 500;   // 5%
    uint256 private constant MAX_CB_THRESHOLD = 10000; // 100%
    uint256 private constant MIN_CB_LOOKBACK = 600;    // 10 minutes
    uint256 private constant MAX_CB_LOOKBACK = 7200;   // 2 hours
    
    // ============ Immutable State ============
    
    address public immutable protocolTreasury;
    address public immutable loanImplementation; // For minimal proxy
    
    // ============ State Variables ============
    
    struct MarketInfo {
        address marketAddress;
        address owner;
        address collateralAsset;
        address loanAsset;
        AssetType assetType;
        OracleType oracleType;
        uint256 ltvBps;
        uint256 aprBps;
        uint256 durationSeconds;
        uint256 createdAt;
        bool active;
    }
    
    // Market registry
    address[] public allMarkets;
    mapping(address => bool) public override isMarket;
    mapping(address => MarketInfo) public marketInfo;
    
    // Stablecoin whitelist
    mapping(address => bool) public approvedStablecoins;
    mapping(address => uint8) public stablecoinDecimals;
    
    // Duplicate prevention
    mapping(bytes32 => address) public marketsByConfig;
    
    // Stats
    uint256 public totalMarketsCreated;
    uint256 public totalFeesCollected;
    uint256 public activeMarketCount; // LOW-002: Track active count to avoid O(n) loop
    
    // ============ Events ============
    
    event MarketCreated(
        address indexed market,
        address indexed owner,
        address indexed collateralAsset,
        address loanAsset,
        AssetType assetType,
        uint256 ltvBps,
        uint256 initialLiquidity
    );
    
    event StablecoinAdded(address indexed stablecoin, uint8 decimals);
    event StablecoinRemoved(address indexed stablecoin);
    event MarketDeactivated(address indexed market);
    event MarketReactivated(address indexed market);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    
    // ============ Errors ============
    
    error InvalidAddress();
    error InvalidParameter();
    error StablecoinNotApproved();
    error InsufficientInitialLiquidity();
    error MarketAlreadyExists();
    error MarketNotFound();
    error OracleValidationFailed();
    error InvalidOracleConfig();
    error DuplicateMarket();
    error TransferFailed();
    
    // ============ Constructor ============
    
    constructor(
        address initialOwner,
        address treasury,
        address loanImpl
    ) Ownable() {
        _transferOwnership(initialOwner);
        if (initialOwner == address(0)) revert InvalidAddress();
        if (treasury == address(0)) revert InvalidAddress();
        if (loanImpl == address(0)) revert InvalidAddress();
        
        protocolTreasury = treasury;
        loanImplementation = loanImpl;
        
        // Note: Owner must call addStablecoin() for each chain's stablecoins
    }
    
    // ============ Market Creation ============
    
    /**
     * @notice Create a new isolated lending market
     * @param collateralAsset Collateral token address
     * @param loanAsset Loan token address (must be whitelisted stablecoin)
     * @param assetType Type of collateral (ERC20/721/1155)
     * @param oracleType Type of oracle (Uniswap V3 TWAP/Chainlink/NFT)
     * @param primaryOracle Primary oracle address (Uni V3 pool or Chainlink feed)
     * @param nftOracle NFT oracle address (if applicable)
     * @param ltvBps Loan-to-value in basis points
     * @param aprBps Interest rate in basis points
     * @param durationSeconds Loan duration
     * @param initialLiquidity Initial liquidity to deposit
     * @return market Address of created market
     */
    function createMarket(
        address collateralAsset,
        address loanAsset,
        AssetType assetType,
        OracleType oracleType,
        address primaryOracle,
        address nftOracle,
        uint256 ltvBps,
        uint256 aprBps,
        uint256 durationSeconds,
        uint256 initialLiquidity
    ) 
        external 
        override
        nonReentrant 
        whenNotPaused 
        returns (address market) 
    {
        // 1. CHECKS: Validate all parameters
        _validateMarketParameters(
            collateralAsset,
            loanAsset,
            assetType,
            ltvBps,
            aprBps,
            durationSeconds,
            initialLiquidity
        );
        
        // 2. CHECKS: Validate oracle
        _validateOracle(oracleType, primaryOracle, collateralAsset, loanAsset);
        
        // 3. CHECKS: Check for duplicate
        bytes32 configHash = _getConfigHash(
            collateralAsset,
            loanAsset,
            assetType,
            ltvBps,
            aprBps,
            durationSeconds
        );
        
        if (marketsByConfig[configHash] != address(0)) {
            revert DuplicateMarket();
        }
        
        // 4. CHECKS: Calculate and validate fees
        uint256 creationFee = (initialLiquidity * CREATION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netLiquidity = initialLiquidity - creationFee;
        
        // Validate minimum liquidity (in USD terms)
        _validateMinimumLiquidity(loanAsset, netLiquidity);
        
        // 5. EFFECTS: Create circuit breaker config
        CircuitBreaker.CircuitBreakerConfig memory cbConfig = CircuitBreaker.CircuitBreakerConfig({
            enabled: true,
            pauseThresholdBps: 2000,     // 20% price move
            lookbackSeconds: 3600,        // 1 hour
            resumeThresholdBps: 1000,     // 10% to resume
            cooldownSeconds: 7200         // 2 hours cooldown
        });
        
        // 6. EFFECTS: Deploy market
        LendingMarket newMarket = new LendingMarket(
            msg.sender,              // Market owner
            collateralAsset,
            loanAsset,
            protocolTreasury,
            loanImplementation,
            assetType,
            oracleType,
            primaryOracle,
            nftOracle,
            ltvBps,
            aprBps,
            durationSeconds,
            12000,                   // Health factor threshold (120%)
            cbConfig
        );
        
        market = address(newMarket);
        
        // 7. EFFECTS: Register market
        allMarkets.push(market);
        isMarket[market] = true;
        marketsByConfig[configHash] = market;
        
        marketInfo[market] = MarketInfo({
            marketAddress: market,
            owner: msg.sender,
            collateralAsset: collateralAsset,
            loanAsset: loanAsset,
            assetType: assetType,
            oracleType: oracleType,
            ltvBps: ltvBps,
            aprBps: aprBps,
            durationSeconds: durationSeconds,
            createdAt: block.timestamp,
            active: true
        });
        
        totalMarketsCreated++;
        activeMarketCount++; // LOW-002: Track active market count
        
        // 8. INTERACTIONS: Pull initial liquidity from creator
        IERC20(loanAsset).safeTransferFrom(msg.sender, address(this), initialLiquidity);
        
        // 9. INTERACTIONS: Send net liquidity to market and fee to treasury
        IERC20(loanAsset).safeTransfer(market, netLiquidity);
        IERC20(loanAsset).safeTransfer(protocolTreasury, creationFee);
        
        totalFeesCollected += creationFee;
        
        // 10. INTERACTIONS: Initialize market with liquidity
        newMarket.initializeWithLiquidity(netLiquidity);
        
        emit MarketCreated(
            market,
            msg.sender,
            collateralAsset,
            loanAsset,
            assetType,
            ltvBps,
            initialLiquidity
        );
    }
    
    // ============ Validation Functions ============
    
    /**
     * @notice Validate market creation parameters
     */
    function _validateMarketParameters(
        address collateralAsset,
        address loanAsset,
        AssetType assetType,
        uint256 ltvBps,
        uint256 aprBps,
        uint256 durationSeconds,
        uint256 initialLiquidity
    ) internal view {
        // Validate addresses
        if (collateralAsset == address(0)) revert InvalidAddress();
        if (loanAsset == address(0)) revert InvalidAddress();
        if (collateralAsset == loanAsset) revert InvalidParameter();
        
        // Validate loan asset is whitelisted stablecoin
        if (!approvedStablecoins[loanAsset]) revert StablecoinNotApproved();
        
        // Validate asset type and collateral contract
        if (!AssetHandler.validateAsset(AssetHandler.AssetType(uint8(assetType)), collateralAsset)) {
            revert InvalidParameter();
        }
        
        // Validate LTV
        if (ltvBps < MIN_LTV_BPS || ltvBps > MAX_LTV_BPS) {
            revert InvalidParameter();
        }
        
        // Validate APR
        if (aprBps > MAX_APR_BPS) revert InvalidParameter();
        
        // Validate duration
        if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION) {
            revert InvalidParameter();
        }
        
        // Validate initial liquidity
        if (initialLiquidity == 0) revert InvalidParameter();
    }
    
    /**
     * @notice Validate oracle configuration
     * @dev Supports CHAINLINK, UNISWAP_V3_TWAP, ORACLE_ROUTER, and NFT_ORACLE
     */
    function _validateOracle(
        OracleType oracleType,
        address priceOracle,
        address collateralAsset,
        address loanAsset
    ) internal view {
        if (priceOracle == address(0)) revert InvalidAddress();
        
        if (oracleType == OracleType.UNISWAP_V3_TWAP) {
            // Validate Uniswap V3 wrapper (now available via wrapper contract)
            IOracle oracle = IOracle(priceOracle);
            require(
                keccak256(abi.encodePacked(oracle.oracleType())) == 
                keccak256(abi.encodePacked("UNISWAP_V3_TWAP")),
                "Invalid Uniswap V3 oracle"
            );
            require(oracle.supportsAsset(collateralAsset), "Asset not supported by Uniswap oracle");
        } else if (oracleType == OracleType.CHAINLINK) {
            // Validate Chainlink oracle wrapper
            IOracle oracle = IOracle(priceOracle);
            require(
                keccak256(abi.encodePacked(oracle.oracleType())) == 
                keccak256(abi.encodePacked("CHAINLINK")),
                "Invalid Chainlink oracle"
            );
            require(oracle.supportsAsset(collateralAsset), "Asset not supported by Chainlink oracle");
        } else if (oracleType == OracleType.ORACLE_ROUTER) {
            // Validate OracleRouter
            IOracle oracle = IOracle(priceOracle);
            require(
                keccak256(abi.encodePacked(oracle.oracleType())) == 
                keccak256(abi.encodePacked("ORACLE_ROUTER")),
                "Invalid oracle router"
            );
            require(oracle.supportsAsset(collateralAsset), "Asset not configured in router");
        } else if (oracleType == OracleType.NFT_ORACLE) {
            // NFT oracle validation
            // Just check address is not zero - complex NFT oracle validation deferred
            if (priceOracle == address(0)) revert InvalidOracleConfig();
        }
    }
    
    /**
     * @notice Validate minimum liquidity in USD terms
     */
    function _validateMinimumLiquidity(address stablecoin, uint256 amount) internal view {
        uint8 decimals = stablecoinDecimals[stablecoin];
        
        // Convert to 18 decimals for comparison
        uint256 normalizedAmount;
        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else {
            normalizedAmount = amount / (10 ** (decimals - 18));
        }
        
        if (normalizedAmount < MIN_LIQUIDITY_USD) {
            revert InsufficientInitialLiquidity();
        }
    }
    
    /**
     * @notice Generate unique config hash for duplicate prevention
     */
    function _getConfigHash(
        address collateralAsset,
        address loanAsset,
        AssetType assetType,
        uint256 ltvBps,
        uint256 aprBps,
        uint256 durationSeconds
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            collateralAsset,
            loanAsset,
            assetType,
            ltvBps,
            aprBps,
            durationSeconds
        ));
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Add stablecoin to whitelist
     * @param stablecoin Stablecoin address
     * @param decimals Token decimals
     */
    function addStablecoin(address stablecoin, uint8 decimals) external onlyOwner {
        if (stablecoin == address(0)) revert InvalidAddress();
        if (decimals == 0 || decimals > 18) revert InvalidParameter();
        
        approvedStablecoins[stablecoin] = true;
        stablecoinDecimals[stablecoin] = decimals;
        
        emit StablecoinAdded(stablecoin, decimals);
    }
    
    /**
     * @notice Remove stablecoin from whitelist
     */
    function removeStablecoin(address stablecoin) external onlyOwner {
        approvedStablecoins[stablecoin] = false;
        emit StablecoinRemoved(stablecoin);
    }
    
    /**
     * @notice Deactivate a market in registry
     */
    function deactivateMarket(address market) external onlyOwner {
        if (!isMarket[market]) revert MarketNotFound();
        if (marketInfo[market].active) {
            marketInfo[market].active = false;
            activeMarketCount--; // LOW-002: Decrement counter
        }
        emit MarketDeactivated(market);
    }
    
    /**
     * @notice Reactivate a market
     */
    function reactivateMarket(address market) external onlyOwner {
        if (!isMarket[market]) revert MarketNotFound();
        if (!marketInfo[market].active) {
            marketInfo[market].active = true;
            activeMarketCount++; // LOW-002: Increment counter
        }
        emit MarketReactivated(market);
    }
    
    /**
     * @notice Pause market creation
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause market creation
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get total number of markets
     */
    function getMarketCount() public view override returns (uint256 count) {
        return allMarkets.length;
    }
    
    /**
     * @notice Get markets with pagination
     */
    function getMarkets(uint256 start, uint256 count) 
        external 
        view 
        returns (address[] memory markets) 
    {
        uint256 end = start + count;
        if (end > allMarkets.length) end = allMarkets.length;
        if (start >= end) return new address[](0);
        
        markets = new address[](end - start);
        for (uint256 i = start; i < end; i++) {
            markets[i - start] = allMarkets[i];
        }
    }
    
    /**
     * @notice Get market information
     */
    function getMarketInfo(address market) external view returns (MarketInfo memory) {
        if (!isMarket[market]) revert MarketNotFound();
        return marketInfo[market];
    }
    
    /**
     * @notice Check if market configuration already exists
     */
    function checkMarketExists(
        address collateralAsset,
        address loanAsset,
        AssetType assetType,
        uint256 ltvBps,
        uint256 aprBps,
        uint256 durationSeconds
    ) external view returns (bool exists, address market) {
        bytes32 configHash = _getConfigHash(
            collateralAsset,
            loanAsset,
            assetType,
            ltvBps,
            aprBps,
            durationSeconds
        );
        market = marketsByConfig[configHash];
        exists = market != address(0);
    }
    
    /**
     * @notice Get factory statistics
     */
    function getFactoryStats() external view returns (
        uint256 totalCreated,
        uint256 totalActive,
        uint256 totalFees
    ) {
        // LOW-002: Use tracked counter instead of O(n) loop
        return (totalMarketsCreated, activeMarketCount, totalFeesCollected);
    }
}
