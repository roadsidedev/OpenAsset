// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

/**
 * @title UniswapV3TWAPOracle
 * @notice Production-grade Uniswap V3 TWAP oracle implementation
 */
library UniswapV3TWAPOracle {
    
    uint32 public constant MIN_TWAP_PERIOD = 600;
    uint32 public constant MAX_TWAP_PERIOD = 1800;
    uint32 public constant RECOMMENDED_TWAP_PERIOD = 1800;
    uint256 public constant MAX_PRICE_DEVIATION = 5000;
    
    error InvalidTWAPPeriod();
    error InsufficientObservations();
    error PriceDeviationTooHigh();
    error InvalidPool();
    
    struct TWAPConfig {
        address pool;
        uint32 twapPeriod;
        address token0;
        address token1;
        bool invertPrice;
    }
    
    function getTWAPPrice(TWAPConfig memory config) 
        internal 
        view 
        returns (uint256 price, uint256 lastUpdate) 
    {
        if (config.twapPeriod < MIN_TWAP_PERIOD || config.twapPeriod > MAX_TWAP_PERIOD) {
            revert InvalidTWAPPeriod();
        }
        
        if (config.pool == address(0)) revert InvalidPool();
        
        IUniswapV3Pool pool = IUniswapV3Pool(config.pool);
        
        (, , , uint16 observationCardinality, , , ) = pool.slot0();
        if (observationCardinality < 2) revert InsufficientObservations();
        
        (int24 arithmeticMeanTick, ) = OracleLibrary.consult(
            config.pool,
            config.twapPeriod
        );
        
        uint256 rawPrice = OracleLibrary.getQuoteAtTick(
            arithmeticMeanTick,
            uint128(1e18),
            config.token0,
            config.token1
        );
        
        price = config.invertPrice ? (1e36 / rawPrice) : rawPrice;
        lastUpdate = block.timestamp;
    }
    
    function createTWAPConfig(
        address pool,
        address baseToken,
        address quoteToken,
        uint32 twapPeriod
    ) internal view returns (TWAPConfig memory config) {
        IUniswapV3Pool poolContract = IUniswapV3Pool(pool);
        address token0 = poolContract.token0();
        address token1 = poolContract.token1();
        
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
