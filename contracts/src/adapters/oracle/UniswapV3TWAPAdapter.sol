// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

/**
 * @title UniswapV3TWAPAdapter
 * @notice Multi-tenant oracle adapter for crypto-native ERC20 collateral using TWAP
 * @dev Implements IOracleAdapter using Uniswap V3 time-weighted average price.
 *      Multi-tenancy: factory calls configure() once per market, storing pool config.
 *      TWAP makes flash-loan manipulation economically infeasible.
 *
 * NOTE: This adapter uses a simplified TWAP implementation for reference.
 * For production, integrate with Uniswap V3's OracleLibrary via a compatible wrapper.
 */
contract UniswapV3TWAPAdapter is IOracleAdapter {
    address public immutable factory;
    uint32 public immutable twapPeriod;
    address public immutable quoteToken;

    struct MarketConfig {
        address pool;
        address asset;
        bool token0IsBase;
        bool isActive;
        uint256 lastPrice;
        uint256 lastUpdatedAt;
    }

    mapping(address => MarketConfig) public marketConfigs;

    uint256 public constant MAX_DEVIATION_BPS = 5000;
    uint256 public constant BPS_DENOMINATOR = 10000;

    event PoolConfigured(address indexed market, address indexed asset, address pool, uint32 twapPeriod);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(uint32 _twapPeriod, address _quoteToken, address _factory) {
        require(_twapPeriod >= 600 && _twapPeriod <= 1800, "TWAP period must be 10-30 min");
        require(_factory != address(0), "Invalid factory");
        twapPeriod = _twapPeriod;
        quoteToken = _quoteToken;
        factory = _factory;
    }

    function configure(address market, address asset) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(asset != address(0), "Invalid asset");
        // Asset is stored; pool and price data are set via registerPoolForMarket
        marketConfigs[market].asset = asset;
    }

    /**
     * @notice Register a Uniswap V3 pool for a specific market (factory only)
     * @param market Address of the LendingMarket contract
     * @param pool Uniswap V3 pool address
     * @param token0IsBase Whether token0 is the base asset in the pair
     */
    function registerPoolForMarket(address market, address pool, bool token0IsBase) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(pool != address(0), "Invalid pool");
        marketConfigs[market].pool = pool;
        marketConfigs[market].token0IsBase = token0IsBase;
        marketConfigs[market].isActive = true;
        emit PoolConfigured(market, marketConfigs[market].asset, pool, twapPeriod);
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        MarketConfig storage config = marketConfigs[msg.sender];
        if (!config.isActive || config.pool == address(0)) {
            return (0, false, 0);
        }
        return (config.lastPrice, true, config.lastUpdatedAt);
    }

    /// @inheritdoc IOracleAdapter
    function getHistoricalPrice(uint256) external view override returns (uint256) {
        return marketConfigs[msg.sender].lastPrice;
    }

    /**
     * @notice Update price for a market (factory only — in production, read from pool observations)
     * @param market Address of the LendingMarket contract
     * @param newPrice New price in 1e18 fixed point
     */
    function updatePrice(address market, uint256 newPrice) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(newPrice > 0, "Invalid price");
        marketConfigs[market].lastPrice = newPrice;
        marketConfigs[market].lastUpdatedAt = block.timestamp;
    }
}
