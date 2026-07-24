// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IOracle.sol";

/**
 * @title ChainlinkOracle
 * @notice Production-grade Chainlink price feed wrapper implementing IOracle interface
 * @dev Provides staleness checks, validation, and admin controls for Chainlink feeds
 * 
 * Features:
 * - Unified IOracle interface (compatible with OracleRouter)
 * - Staleness detection with configurable heartbeat
 * - Feed activation/deactivation for emergency response
 * - Comprehensive event logging
 * - Batch configuration for gas efficiency
 * 
 * @custom:security-contact security@openasset.io
 */
contract ChainlinkOracle is IOracle {
    
    // ============ Constants ============
    
    uint256 private constant MAX_PRICE_AGE_DEFAULT = 3600; // 1 hour
    uint256 private constant BPS_DENOMINATOR = 10000;
    
    // ============ Immutable State ============
    
    address public immutable owner;
    
    // ============ Storage ============
    
    struct FeedConfig {
        address feedAddress;     // Chainlink aggregator address
        uint32 heartbeat;        // Expected update frequency in seconds
        bool isActive;           // Admin can disable feeds for emergency
    }
    
    // asset => FeedConfig
    mapping(address => FeedConfig) public feedConfigs;
    
    // Track registered assets
    address[] public registeredAssets;
    mapping(address => bool) public isRegistered;
    
    // ============ Events ============
    
    event FeedRegistered(
        address indexed asset,
        address indexed feed,
        uint32 heartbeat
    );
    
    event FeedDeactivated(address indexed asset, address indexed feed);
    event FeedReactivated(address indexed asset, address indexed feed);
    
    event PriceFetched(
        address indexed asset,
        uint256 price,
        uint256 updatedAt,
        uint8 decimals
    );
    
    // ============ Errors ============
    
    error Unauthorized();
    error InvalidFeed();
    error StalePrice();
    error InvalidPrice();
    error AssetNotSupported();
    error FeedInactive();
    error ZeroHeartbeat();
    
    // ============ Constructor ============
    
    /**
     * @notice Initialize ChainlinkOracle
     * @param _owner Admin address for managing feeds
     */
    constructor(address _owner) {
        require(_owner != address(0), "Invalid owner");
        owner = _owner;
    }
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Register a Chainlink price feed for an asset
     * @param asset Asset address to price
     * @param feed Chainlink aggregator address
     * @param heartbeat Expected update frequency in seconds
     * 
     * Requirements:
     * - asset and feed must not be zero addresses
     * - heartbeat must be > 0
     * - feed must be callable and return valid data
     */
    function registerFeed(
        address asset,
        address feed,
        uint32 heartbeat
    ) external onlyOwner {
        require(asset != address(0), "Invalid asset");
        require(feed != address(0), "Invalid feed");
        if (heartbeat == 0) revert ZeroHeartbeat();
        
        // Validate feed is callable and returns valid data
        AggregatorV3Interface aggregator = AggregatorV3Interface(feed);
        
        try aggregator.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            require(answer > 0, "Invalid feed data");
            require(updatedAt > 0, "Feed not initialized");
            require(answeredInRound >= roundId, "Stale feed");
        } catch {
            revert InvalidFeed();
        }
        
        feedConfigs[asset] = FeedConfig({
            feedAddress: feed,
            heartbeat: heartbeat,
            isActive: true
        });
        
        if (!isRegistered[asset]) {
            registeredAssets.push(asset);
            isRegistered[asset] = true;
        }
        
        emit FeedRegistered(asset, feed, heartbeat);
    }
    
    /**
     * @notice Batch register feeds (gas efficient)
     * @param assets Array of asset addresses
     * @param feeds Array of Chainlink feed addresses
     * @param heartbeats Array of heartbeat values
     */
    function registerFeedBatch(
        address[] calldata assets,
        address[] calldata feeds,
        uint32[] calldata heartbeats
    ) external onlyOwner {
        uint256 length = assets.length;
        require(
            length == feeds.length && length == heartbeats.length,
            "Length mismatch"
        );
        
        for (uint256 i = 0; i < length; i++) {
            this.registerFeed(assets[i], feeds[i], heartbeats[i]);
        }
    }
    
    /**
     * @notice Deactivate a price feed (emergency response)
     * @param asset Asset address
     */
    function deactivateFeed(address asset) external onlyOwner {
        FeedConfig storage config = feedConfigs[asset];
        require(config.feedAddress != address(0), "Feed not registered");
        config.isActive = false;
        emit FeedDeactivated(asset, config.feedAddress);
    }
    
    /**
     * @notice Reactivate a price feed
     * @param asset Asset address
     */
    function reactivateFeed(address asset) external onlyOwner {
        FeedConfig storage config = feedConfigs[asset];
        require(config.feedAddress != address(0), "Feed not registered");
        config.isActive = true;
        emit FeedReactivated(asset, config.feedAddress);
    }
    
    // ============ IOracle Implementation ============
    
    /**
     * @notice Get price from Chainlink feed (IOracle interface)
     * @param asset Asset to price
     * @return price Price with 18 decimals (1e18 = $1.00)
     * @return decimals Number of decimals (always 18)
     * 
     * Reverts if:
     * - Asset not supported
     * - Feed inactive
     * - Price is invalid (≤ 0)
     * - Price is stale (older than heartbeat + 5 min buffer)
     */
    function getPrice(address asset) 
        external 
        view 
        override 
        returns (uint256 price, uint8 decimals) 
    {
        FeedConfig memory config = feedConfigs[asset];
        
        if (config.feedAddress == address(0)) revert AssetNotSupported();
        if (!config.isActive) revert FeedInactive();
        
        AggregatorV3Interface feed = AggregatorV3Interface(config.feedAddress);
        
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();
        
        // Validate price data
        if (answer <= 0) revert InvalidPrice();
        if (updatedAt == 0) revert StalePrice();
        if (answeredInRound < roundId) revert StalePrice();
        
        // Check staleness: price shouldn't be older than heartbeat + 5 min buffer
        uint256 maxAge = uint256(config.heartbeat) + 300;
        if (block.timestamp - updatedAt > maxAge) {
            revert StalePrice();
        }
        
        // Convert to 18 decimals
        uint8 feedDecimals = feed.decimals();
        if (feedDecimals < 18) {
            price = uint256(answer) * (10 ** (18 - feedDecimals));
        } else if (feedDecimals > 18) {
            price = uint256(answer) / (10 ** (feedDecimals - 18));
        } else {
            price = uint256(answer);
        }
        
        decimals = 18;
    }
    
    /**
     * @notice Get last update timestamp
     * @param asset Asset address
     * @return timestamp Unix timestamp of last price update
     */
    function getLastUpdate(address asset) 
        external 
        view 
        override 
        returns (uint256 timestamp) 
    {
        FeedConfig memory config = feedConfigs[asset];
        if (config.feedAddress == address(0)) revert AssetNotSupported();
        
        AggregatorV3Interface feed = AggregatorV3Interface(config.feedAddress);
        (, , , uint256 updatedAt, ) = feed.latestRoundData();
        
        return updatedAt;
    }
    
    /**
     * @notice Check if asset is supported
     * @param asset Asset address
     * @return supported True if feed is registered and active
     */
    function supportsAsset(address asset) 
        external 
        view 
        override 
        returns (bool supported) 
    {
        FeedConfig memory config = feedConfigs[asset];
        return config.feedAddress != address(0) && config.isActive;
    }
    
    /**
     * @notice Get oracle type identifier
     * @return oracleType Always returns "CHAINLINK"
     */
    function oracleType() 
        external 
        pure 
        override 
        returns (string memory) 
    {
        return "CHAINLINK";
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get feed configuration for an asset
     * @param asset Asset address
     * @return feed Chainlink aggregator address
     * @return heartbeat Expected update frequency
     * @return isActive Whether feed is currently active
     */
    function getFeedConfig(address asset) 
        external 
        view 
        returns (
            address feed,
            uint32 heartbeat,
            bool isActive
        ) 
    {
        FeedConfig memory config = feedConfigs[asset];
        return (config.feedAddress, config.heartbeat, config.isActive);
    }
    
    /**
     * @notice Get all registered assets
     * @return assets Array of asset addresses
     */
    function getRegisteredAssets() 
        external 
        view 
        returns (address[] memory assets) 
    {
        return registeredAssets;
    }
    
    /**
     * @notice Get detailed price data (for diagnostics)
     * @param asset Asset address
     * @return price Current price with 18 decimals
     * @return updatedAt Timestamp of last update
     * @return roundId Chainlink round ID
     * @return answeredInRound Chainlink answered in round
     * @return isStale Whether price is considered stale
     */
    function getPriceDetails(address asset) 
        external 
        view 
        returns (
            uint256 price,
            uint256 updatedAt,
            uint80 roundId,
            uint80 answeredInRound,
            bool isStale
        ) 
    {
        FeedConfig memory config = feedConfigs[asset];
        require(config.feedAddress != address(0), "Asset not supported");
        
        AggregatorV3Interface feed = AggregatorV3Interface(config.feedAddress);
        
        (
            uint80 _roundId,
            int256 answer,
            ,
            uint256 _updatedAt,
            uint80 _answeredInRound
        ) = feed.latestRoundData();
        
        // Convert to 18 decimals
        uint8 feedDecimals = feed.decimals();
        if (feedDecimals < 18) {
            price = uint256(answer) * (10 ** (18 - feedDecimals));
        } else if (feedDecimals > 18) {
            price = uint256(answer) / (10 ** (feedDecimals - 18));
        } else {
            price = uint256(answer);
        }
        
        updatedAt = _updatedAt;
        roundId = _roundId;
        answeredInRound = _answeredInRound;
        
        uint256 maxAge = uint256(config.heartbeat) + 300;
        isStale = (block.timestamp - _updatedAt > maxAge);
    }
}
