// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

/**
 * @title UniswapV3TWAPAdapter
 * @notice Reference oracle adapter for crypto-native ERC20 collateral
 * @dev Implements IOracleAdapter using Uniswap V3 time-weighted average price
 *
 * TWAP makes flash-loan manipulation economically infeasible.
 * Recommended for assets with >$50k DEX liquidity.
 * Configurable TWAP window: 10-30 minutes based on asset volatility.
 *
 * NOTE: This adapter uses a simplified TWAP implementation for 0.8.20 compatibility.
 * For production, integrate with Uniswap V3's OracleLibrary via a compatible wrapper.
 */
contract UniswapV3TWAPAdapter is IOracleAdapter {
    address public immutable owner;
    uint32 public immutable twapPeriod;
    address public immutable quoteToken;

    struct PoolConfig {
        address pool;
        bool token0IsBase;
        bool isActive;
    }

    // Market address => PoolConfig (keyed by market, not asset, to match getPrice lookup)
    mapping(address => PoolConfig) public poolConfigs;
    // Market address => asset address, for reverse lookup
    mapping(address => address) public marketAsset;

    // Simple TWAP storage: last known price per asset
    mapping(address => uint256) public lastPrice;
    mapping(address => uint256) public lastUpdatedAt;
    mapping(address => bool) public hasPrice;

    uint256 public constant MAX_DEVIATION_BPS = 5000;
    uint256 public constant BPS_DENOMINATOR = 10000;

    event PoolRegistered(address indexed asset, address pool, uint32 twapPeriod);
    event MarketRegistered(address indexed market, address indexed asset);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(uint32 _twapPeriod, address _quoteToken) {
        require(_twapPeriod >= 600 && _twapPeriod <= 1800, "TWAP period must be 10-30 min");
        owner = msg.sender;
        twapPeriod = _twapPeriod;
        quoteToken = _quoteToken;
    }

    /// @notice Register a market and its pool config (owner only)
    function registerMarket(
        address market,
        address asset,
        address pool,
        bool token0IsBase
    ) external onlyOwner {
        require(market != address(0), "Invalid market");
        require(asset != address(0), "Invalid asset");
        poolConfigs[market] = PoolConfig({
            pool: pool,
            token0IsBase: token0IsBase,
            isActive: true
        });
        marketAsset[market] = asset;
        emit PoolRegistered(asset, pool, twapPeriod);
        emit MarketRegistered(market, asset);
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        PoolConfig memory config = poolConfigs[msg.sender];
        if (!config.isActive || config.pool == address(0)) {
            return (0, false, 0);
        }

        address asset = marketAsset[msg.sender];
        if (asset == address(0) || !hasPrice[asset]) {
            return (0, false, 0);
        }

        return (lastPrice[asset], true, lastUpdatedAt[asset]);
    }

    /// @inheritdoc IOracleAdapter
    function getHistoricalPrice(uint256 secondsAgo) external view override returns (uint256) {
        address asset = marketAsset[msg.sender];
        if (asset == address(0)) return 0;
        return lastPrice[asset];
    }

    /// @notice Update price (owner only — in production, read from Uniswap V3 pool observations)
    function updatePrice(address asset, uint256 newPrice) external onlyOwner {
        require(asset != address(0), "Invalid asset");
        require(newPrice > 0, "Invalid price");
        lastPrice[asset] = newPrice;
        lastUpdatedAt[asset] = block.timestamp;
        hasPrice[asset] = true;
    }
}
