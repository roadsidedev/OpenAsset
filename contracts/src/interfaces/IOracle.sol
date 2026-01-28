// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title IOracle
 * @notice Unified oracle interface for all oracle types (Chainlink, Uniswap V3, etc.)
 * @dev Implemented by ChainlinkOracle, UniswapV3TWAPWrapper, and OracleRouter
 * 
 * All prices must be returned with 18 decimals (1e18 = $1.00)
 */
interface IOracle {
    /**
     * @notice Get the current price of an asset
     * @param asset Address of the asset to price
     * @return price Price in USD with 18 decimals (1e18 = $1.00)
     * @return decimals Number of decimals in the price (always 18)
     */
    function getPrice(address asset) external view returns (uint256 price, uint8 decimals);
    
    /**
     * @notice Get the timestamp of the last price update
     * @param asset Address of the asset
     * @return timestamp Unix timestamp of last update
     */
    function getLastUpdate(address asset) external view returns (uint256 timestamp);
    
    /**
     * @notice Check if the oracle supports a given asset
     * @param asset Address of the asset
     * @return supported True if oracle can price this asset
     */
    function supportsAsset(address asset) external view returns (bool supported);
    
    /**
     * @notice Get the type of oracle (for diagnostics and routing)
     * @return oracleType String identifier (e.g., "CHAINLINK", "UNISWAP_V3_TWAP", "ORACLE_ROUTER")
     */
    function oracleType() external pure returns (string memory oracleType);
}

/**
 * @title IOracleRegistry
 * @notice Registry interface for managing multiple oracle sources
 * @dev Used by OracleRouter and market factories
 */
interface IOracleRegistry {
    /**
     * @notice Register an oracle for a specific asset
     * @param asset Asset address
     * @param oracle Oracle contract address
     * @param isPrimary Whether this is the primary oracle for the asset
     */
    function registerOracle(address asset, address oracle, bool isPrimary) external;
    
    /**
     * @notice Get the primary oracle for an asset
     * @param asset Asset address
     * @return oracle Primary oracle address
     */
    function getPrimaryOracle(address asset) external view returns (address oracle);
    
    /**
     * @notice Get all oracles for an asset (primary + fallbacks)
     * @param asset Asset address
     * @return oracles Array of oracle addresses (ordered by priority)
     */
    function getOracles(address asset) external view returns (address[] memory oracles);
}

/**
 * @title INFTOracle
 * @notice Oracle interface for NFT floor prices (Reservoir, OpenSea)
 */
interface INFTOracle {
    /**
     * @notice Get NFT collection floor price
     * @param collection NFT collection address
     * @return floorPrice Floor price in ETH with 18 decimals
     */
    function getFloorPrice(address collection) external view returns (uint256 floorPrice);
    
    /**
     * @notice Get NFT collection floor price in USD
     * @param collection NFT collection address
     * @return priceUsd Floor price in USD with 18 decimals
     */
    function getFloorPriceUSD(address collection) external view returns (uint256 priceUsd);
    
    /**
     * @notice Get specific NFT valuation (if available)
     * @param collection NFT collection address
     * @param tokenId Token ID
     * @return price Estimated price in ETH with 18 decimals
     */
    function getNFTPrice(address collection, uint256 tokenId) external view returns (uint256 price);
    
    /**
     * @notice Check if floor price is stale
     * @param collection NFT collection address
     * @return isStale True if price hasn't updated recently
     */
    function isPriceStale(address collection) external view returns (bool isStale);
}



/**
 * @notice Oracle type enum for market configuration
 * @dev Used to determine which oracle implementation to use
 */
enum OracleType {
    UNISWAP_V3_TWAP,    // 0: Uniswap V3 TWAP wrapper
    CHAINLINK,          // 1: Chainlink price feed
    NFT_ORACLE,         // 2: NFT-specific oracle
    ORACLE_ROUTER       // 3: Multi-source oracle router (NEW)
}
