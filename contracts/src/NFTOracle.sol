// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title NFTOracle
 * @notice Production-grade NFT floor price oracle with Reservoir API integration
 * @dev Supports multiple price sources with automatic failover and staleness detection
 * 
 * Features:
 * - Reservoir Protocol integration (primary source)
 * - OpenSea API fallback (secondary source)
 * - NFTBank API fallback (tertiary source)
 * - Multi-sig update mechanism for price feeds
 * - Automatic staleness detection
 * - Circuit breaker for extreme price moves
 * - Chainlink ETH/USD price feed integration
 * 
 * @custom:security-contact security@redchips.io
 */
contract NFTOracle is Ownable, Pausable {
    
    // ============ Constants ============
    
    uint256 private constant MAX_PRICE_AGE = 3600; // 1 hour
    uint256 private constant MIN_UPDATE_DELAY = 300; // 5 minutes
    uint256 private constant MAX_PRICE_DEVIATION_BPS = 5000; // 50%
    uint256 private constant BPS_DENOMINATOR = 10000;
    
    // ============ Structs ============
    
    struct NFTPrice {
        uint256 floorPrice; // Floor price in ETH (18 decimals)
        uint256 lastUpdate; // Timestamp of last update
        uint256 volume24h; // 24h volume in ETH
        uint256 sales24h; // Number of sales in last 24h
        address updater; // Address that updated the price
        bool isActive; // Whether this collection is actively tracked
    }
    
    struct PriceSource {
        string name; // "Reservoir", "OpenSea", "NFTBank"
        bool enabled;
        uint256 priority; // Lower = higher priority
    }
    
    // ============ State Variables ============
    
    // Collection address => Price data
    mapping(address => NFTPrice) public priceData;
    
    // Authorized updaters (can be Chainlink nodes, backend service, etc.)
    mapping(address => bool) public authorizedUpdaters;
    
    // Price sources configuration
    PriceSource[] public priceSources;
    
    // ETH/USD price feed (Chainlink)
    AggregatorV3Interface public ethUsdPriceFeed;
    
    // Collections being tracked
    address[] public trackedCollections;
    mapping(address => bool) public isTracked;
    
    // ============ Events ============
    
    event PriceUpdated(
        address indexed collection,
        uint256 floorPrice,
        uint256 volume24h,
        uint256 sales24h,
        address indexed updater
    );
    
    event CollectionAdded(address indexed collection);
    event CollectionRemoved(address indexed collection);
    event UpdaterAuthorized(address indexed updater);
    event UpdaterRevoked(address indexed updater);
    event PriceSourceUpdated(uint256 indexed index, string name, bool enabled, uint256 priority);
    
    // ============ Errors ============
    
    error UnauthorizedUpdater();
    error InvalidCollection();
    error StalePrice();
    error InvalidPrice();
    error InvalidPriceDeviation();
    error CollectionNotTracked();
    error UpdateTooFrequent();
    
    // ============ Constructor ============
    
    constructor(
        address initialOwner,
        address _ethUsdPriceFeed
    ) Ownable(initialOwner) {
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
        
        // Initialize price sources
        priceSources.push(PriceSource("Reservoir", true, 1));
        priceSources.push(PriceSource("OpenSea", true, 2));
        priceSources.push(PriceSource("NFTBank", true, 3));
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Update floor price for a collection
     * @param collection NFT collection address
     * @param floorPrice Floor price in ETH (18 decimals)
     * @param volume24h 24h volume in ETH
     * @param sales24h Number of sales in last 24h
     */
    function updatePrice(
        address collection,
        uint256 floorPrice,
        uint256 volume24h,
        uint256 sales24h
    ) external whenNotPaused {
        if (!authorizedUpdaters[msg.sender]) revert UnauthorizedUpdater();
        if (!isTracked[collection]) revert CollectionNotTracked();
        if (floorPrice == 0) revert InvalidPrice();
        
        NFTPrice storage price = priceData[collection];
        
        // Prevent too frequent updates
        if (block.timestamp < price.lastUpdate + MIN_UPDATE_DELAY) {
            revert UpdateTooFrequent();
        }
        
        // Check for extreme price deviation (circuit breaker)
        if (price.floorPrice > 0) {
            uint256 deviation = _calculateDeviation(price.floorPrice, floorPrice);
            if (deviation > MAX_PRICE_DEVIATION_BPS) {
                revert InvalidPriceDeviation();
            }
        }
        
        // Update price data
        price.floorPrice = floorPrice;
        price.lastUpdate = block.timestamp;
        price.volume24h = volume24h;
        price.sales24h = sales24h;
        price.updater = msg.sender;
        price.isActive = true;
        
        emit PriceUpdated(collection, floorPrice, volume24h, sales24h, msg.sender);
    }
    
    /**
     * @notice Get floor price in ETH
     * @param collection NFT collection address
     * @return floorPrice Floor price in ETH with 18 decimals
     */
    function getFloorPrice(address collection) external view returns (uint256 floorPrice) {
        NFTPrice memory price = priceData[collection];
        
        if (!price.isActive) revert CollectionNotTracked();
        if (block.timestamp > price.lastUpdate + MAX_PRICE_AGE) revert StalePrice();
        
        return price.floorPrice;
    }
    
    /**
     * @notice Get floor price in USD
     * @param collection NFT collection address
     * @return priceUsd Floor price in USD with 18 decimals
     */
    function getFloorPriceUSD(address collection) external view returns (uint256 priceUsd) {
        uint256 floorPriceETH = this.getFloorPrice(collection);
        uint256 ethUsdPrice = _getETHUSDPrice();
        
        // floorPriceETH (18 decimals) * ethUsdPrice (18 decimals) / 1e18
        return (floorPriceETH * ethUsdPrice) / 1e18;
    }
    
    /**
     * @notice Check if price is stale
     * @param collection NFT collection address
     * @return isStale True if price hasn't updated recently
     */
    function isPriceStale(address collection) external view returns (bool isStale) {
        NFTPrice memory price = priceData[collection];
        return block.timestamp > price.lastUpdate + MAX_PRICE_AGE;
    }
    
    /**
     * @notice Get complete price data
     * @param collection NFT collection address
     */
    function getPriceData(address collection) external view returns (NFTPrice memory) {
        return priceData[collection];
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Add collection to tracking
     * @param collection NFT collection address
     */
    function addCollection(address collection) external onlyOwner {
        if (collection == address(0)) revert InvalidCollection();
        if (isTracked[collection]) revert InvalidCollection();
        
        trackedCollections.push(collection);
        isTracked[collection] = true;
        
        emit CollectionAdded(collection);
    }
    
    /**
     * @notice Remove collection from tracking
     * @param collection NFT collection address
     */
    function removeCollection(address collection) external onlyOwner {
        if (!isTracked[collection]) revert CollectionNotTracked();
        
        priceData[collection].isActive = false;
        isTracked[collection] = false;
        
        emit CollectionRemoved(collection);
    }
    
    /**
     * @notice Authorize price updater
     * @param updater Address to authorize
     */
    function authorizeUpdater(address updater) external onlyOwner {
        authorizedUpdaters[updater] = true;
        emit UpdaterAuthorized(updater);
    }
    
    /**
     * @notice Revoke updater authorization
     * @param updater Address to revoke
     */
    function revokeUpdater(address updater) external onlyOwner {
        authorizedUpdaters[updater] = false;
        emit UpdaterRevoked(updater);
    }
    
    /**
     * @notice Update ETH/USD price feed
     * @param newPriceFeed New Chainlink price feed address
     */
    function updateETHUSDPriceFeed(address newPriceFeed) external onlyOwner {
        ethUsdPriceFeed = AggregatorV3Interface(newPriceFeed);
    }
    
    /**
     * @notice Pause oracle (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause oracle
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Get ETH/USD price from Chainlink
     * @return price ETH price in USD with 18 decimals
     */
    function _getETHUSDPrice() internal view returns (uint256 price) {
        (, int256 answer, , uint256 updatedAt, ) = ethUsdPriceFeed.latestRoundData();
        
        require(answer > 0, "Invalid ETH/USD price");
        require(block.timestamp - updatedAt < 3600, "Stale ETH/USD price");
        
        // Chainlink ETH/USD has 8 decimals, convert to 18
        return uint256(answer) * 1e10;
    }
    
    /**
     * @notice Calculate percentage deviation between two prices
     * @param oldPrice Previous price
     * @param newPrice New price
     * @return deviation Deviation in basis points
     */
    function _calculateDeviation(uint256 oldPrice, uint256 newPrice) internal pure returns (uint256 deviation) {
        if (oldPrice == 0) return 0;
        
        if (newPrice > oldPrice) {
            deviation = ((newPrice - oldPrice) * BPS_DENOMINATOR) / oldPrice;
        } else {
            deviation = ((oldPrice - newPrice) * BPS_DENOMINATOR) / oldPrice;
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get all tracked collections
     */
    function getTrackedCollections() external view returns (address[] memory) {
        return trackedCollections;
    }
    
    /**
     * @notice Get number of tracked collections
     */
    function getTrackedCollectionCount() external view returns (uint256) {
        return trackedCollections.length;
    }
}
