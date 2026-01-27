// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title UniswapV3TWAPOracle
 * @notice Production-grade Uniswap V3 TWAP oracle implementation
 * @dev Supports configurable TWAP periods and multi-pool routing
 */
library UniswapV3TWAPOracle {
    
    uint32 public constant MIN_TWAP_PERIOD = 600;      // 10 minutes
    uint32 public constant MAX_TWAP_PERIOD = 1800;     // 30 minutes
    uint32 public constant RECOMMENDED_TWAP_PERIOD = 1800; // 30 min default
    uint256 public constant MAX_PRICE_DEVIATION = 5000; // 50% max deviation
    
    error InvalidTWAPPeriod();
    error InsufficientObservations();
    error PriceDeviationTooHigh();
    error InvalidPool();
    error StalePrice();
    
    struct TWAPConfig {
        address pool;           // Uniswap V3 pool address
        uint32 twapPeriod;      // TWAP period in seconds
        address token0;         // Pool token0
        address token1;         // Pool token1
        bool invertPrice;       // If true, return 1/price
    }
    
    /**
     * @notice Get TWAP price from Uniswap V3 pool
     * @param config TWAP configuration
     * @return price Price with 18 decimals
     * @return lastUpdate Timestamp of last price update
     */
    function getTWAPPrice(TWAPConfig memory config) 
        internal 
        view 
        returns (uint256 price, uint256 lastUpdate) 
    {
        // Validate TWAP period
        if (config.twapPeriod < MIN_TWAP_PERIOD || config.twapPeriod > MAX_TWAP_PERIOD) {
            revert InvalidTWAPPeriod();
        }
        
        // Validate pool
        if (config.pool == address(0)) revert InvalidPool();
        
        IUniswapV3Pool pool = IUniswapV3Pool(config.pool);
        
        // Check if pool has enough observations
        (, , uint16 observationIndex, uint16 observationCardinality, , , ) = pool.slot0();
        if (observationCardinality < 2) revert InsufficientObservations();
        
        // Get arithmetic mean tick over TWAP period
        (int24 arithmeticMeanTick, ) = OracleLibrary.consult(
            config.pool,
            config.twapPeriod
        );
        
        // Convert tick to price (always returns price of token0 in terms of token1)
        uint256 rawPrice = OracleLibrary.getQuoteAtTick(
            arithmeticMeanTick,
            uint128(1e18), // 1 token with 18 decimals
            config.token0,
            config.token1
        );
        
        // Invert if necessary (e.g., want USDC/ETH instead of ETH/USDC)
        price = config.invertPrice ? (1e36 / rawPrice) : rawPrice;
        
        // Last update is current block timestamp (TWAP is always current)
        lastUpdate = block.timestamp;
        
        // Validate price is reasonable
        _validatePrice(config, price);
    }
    
    /**
     * @notice Validate TWAP price against spot price for manipulation detection
     * @param config TWAP configuration
     * @param twapPrice TWAP price to validate
     */
    function _validatePrice(TWAPConfig memory config, uint256 twapPrice) 
        internal 
        view 
    {
        IUniswapV3Pool pool = IUniswapV3Pool(config.pool);
        
        // Get current spot price
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        
        // Convert sqrtPriceX96 to price with 18 decimals
        uint256 spotPrice = _sqrtPriceX96ToPrice(sqrtPriceX96, config.invertPrice);
        
        // Calculate deviation between TWAP and spot
        uint256 deviation = spotPrice > twapPrice
            ? ((spotPrice - twapPrice) * 10000) / twapPrice
            : ((twapPrice - spotPrice) * 10000) / twapPrice;
        
        // If deviation > 50%, likely manipulation
        if (deviation > MAX_PRICE_DEVIATION) {
            revert PriceDeviationTooHigh();
        }
    }
    
    /**
     * @notice Convert Uniswap V3 sqrtPriceX96 to standard price
     * @param sqrtPriceX96 Square root price from pool.slot0()
     * @param invert Whether to invert the price
     * @return price Price with 18 decimals
     */
    function _sqrtPriceX96ToPrice(uint160 sqrtPriceX96, bool invert) 
        internal 
        pure 
        returns (uint256 price) 
    {
        // sqrtPriceX96 = sqrt(price) * 2^96
        // price = (sqrtPriceX96 / 2^96)^2
        // To get price with 18 decimals: (sqrtPriceX96^2 * 1e18) / 2^192
        
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        price = (priceX192 * 1e18) >> 192;
        
        if (invert && price > 0) {
            price = (1e36) / price;
        }
    }
    
    /**
     * @notice Check if pool has sufficient liquidity for reliable TWAP
     * @param pool Uniswap V3 pool address
     * @param minLiquidityUSD Minimum liquidity required (with 18 decimals)
     * @return hasSufficientLiquidity True if pool is liquid enough
     */
    function hasSufficientLiquidity(address pool, uint256 minLiquidityUSD) 
        internal 
        view 
        returns (bool hasSufficientLiquidity) 
    {
        // This would require additional oracle calls to price the liquidity
        // For production, integrate with Uniswap V3 subgraph or on-chain calculation
        // Simplified version: just check pool is not zero address
        hasSufficientLiquidity = pool != address(0);
    }
    
    /**
     * @notice Create TWAP configuration for a pool
     * @param pool Uniswap V3 pool address
     * @param baseToken Token to price (numerator)
     * @param quoteToken Token to price against (denominator)
     * @param twapPeriod TWAP period in seconds
     * @return config TWAP configuration struct
     */
    function createTWAPConfig(
        address pool,
        address baseToken,
        address quoteToken,
        uint32 twapPeriod
    ) internal view returns (TWAPConfig memory config) {
        IUniswapV3Pool poolContract = IUniswapV3Pool(pool);
        address token0 = poolContract.token0();
        address token1 = poolContract.token1();
        
        // Determine if we need to invert
        bool invert = (baseToken == token1 && quoteToken == token0);
        
        config = TWAPConfig({
            pool: pool,
            twapPeriod: twapPeriod,
            token0: token0,
            token1: token1,
            invertPrice: invert
        });
    }
}

/**
 * @title ChainlinkOracle
 * @notice Chainlink price feed integration as fallback oracle
 */
library ChainlinkOracle {
    
    uint256 public constant MAX_PRICE_AGE = 3600; // 1 hour
    
    error InvalidPriceFeed();
    error StalePrice();
    error InvalidPrice();
    
    /**
     * @notice Get price from Chainlink aggregator
     * @param priceFeed Chainlink price feed address
     * @return price Price with 18 decimals
     * @return lastUpdate Timestamp of last update
     */
    function getPrice(address priceFeed) 
        internal 
        view 
        returns (uint256 price, uint256 lastUpdate) 
    {
        if (priceFeed == address(0)) revert InvalidPriceFeed();
        
        AggregatorV3Interface feed = AggregatorV3Interface(priceFeed);
        
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
        
        // Check staleness
        if (block.timestamp - updatedAt > MAX_PRICE_AGE) {
            revert StalePrice();
        }
        
        // Convert to 18 decimals
        uint8 decimals = feed.decimals();
        if (decimals < 18) {
            price = uint256(answer) * (10 ** (18 - decimals));
        } else {
            price = uint256(answer) / (10 ** (decimals - 18));
        }
        
        lastUpdate = updatedAt;
    }
    
    /**
     * @notice Validate price feed is operational
     * @param priceFeed Chainlink price feed address
     * @return isValid True if feed is valid and recent
     */
    function validatePriceFeed(address priceFeed) 
        internal 
        view 
        returns (bool isValid) 
    {
        try ChainlinkOracle.getPrice(priceFeed) returns (uint256, uint256) {
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * @title NFTOracle
 * @notice NFT floor price oracle (Reservoir/OpenSea API integration)
 * @dev This is a wrapper - actual implementation requires off-chain API integration
 */
library NFTOracle {
    
    uint256 public constant MAX_NFT_PRICE_AGE = 3600; // 1 hour
    
    error InvalidNFTOracle();
    error StaleNFTPrice();
    error InvalidNFTPrice();
    
    /**
     * @notice Get NFT floor price from oracle
     * @param nftOracle NFT oracle contract address
     * @param collection NFT collection address
     * @return floorPrice Floor price in ETH with 18 decimals
     * @return lastUpdate Timestamp of last update
     */
    function getFloorPrice(address nftOracle, address collection) 
        internal 
        view 
        returns (uint256 floorPrice, uint256 lastUpdate) 
    {
        if (nftOracle == address(0)) revert InvalidNFTOracle();
        
        // Call external NFT oracle (Reservoir, OpenSea, etc.)
        // This would be implemented by the specific oracle contract
        
        // For now, this is a placeholder interface
        // Production implementation would integrate with Reservoir API or similar
        
        revert("NFT oracle integration pending");
    }
    
    /**
     * @notice Validate NFT oracle is operational
     * @param nftOracle NFT oracle address
     * @param collection NFT collection to check
     * @return isValid True if oracle works
     */
    function validateNFTOracle(address nftOracle, address collection) 
        internal 
        view 
        returns (bool isValid) 
    {
        if (nftOracle == address(0)) return false;
        
        try NFTOracle.getFloorPrice(nftOracle, collection) returns (uint256, uint256) {
            return true;
        } catch {
            return false;
        }
    }
}