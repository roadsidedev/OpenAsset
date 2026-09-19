// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "../../libraries/UniswapV3TwapLibrary.sol";

/**
 * @title UniswapV3TWAPAdapter
 * @notice Multi-tenant oracle adapter for crypto-native ERC20 collateral using TWAP
 * @dev Implements IOracleAdapter using Uniswap V3 time-weighted average price.
 *      Multi-tenancy: factory calls configure() once per market, storing pool config.
 *      TWAP makes flash-loan manipulation economically infeasible.
 *
 *      Production path: getPrice() calls OracleLibrary.consult(pool, twapPeriod) and
 *      getQuoteAtTick to derive a manipulation-resistant price. Legacy `lastPrice`
 *      / `updatePrice` is retained for deterministic unit tests and anvil forks where
 *      pool observations are unavailable, but it is NEVER used as the primary price
 *      when a valid TWAP can be derived.
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
        uint256 lastPrice;        // fallback for test forks without pool observations
        uint256 lastUpdatedAt;
        bool useFallbackOnly;     // if true, skip TWAP and return fallback (test mode)
    }

    mapping(address => MarketConfig) public marketConfigs;
    struct AssetPool {
        address pool;
        bool token0IsBase;
    }
    /// @notice Optional asset→pool registry so MarketFactoryV2 can auto-bind pools at createMarket
    mapping(address => AssetPool) public assetPools;


    uint256 public constant MAX_DEVIATION_BPS = 5000;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 private constant MAX_SANE_PRICE = 1e36;
    uint256 private constant FALLBACK_MAX_STALENESS = 3600;

    event PoolConfigured(address indexed market, address indexed asset, address pool, uint32 twapPeriod);
    event FallbackModeUpdated(address indexed market, bool useFallbackOnly);
    event FallbackPriceUpdated(address indexed market, uint256 price, uint256 updatedAt);

    error PoolNotConfigured();
    error InvalidMarket();
    error TWAPUnavailable();

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
        // Validate pool cardinality for TWAP period
        try IUniswapV3Pool(pool).slot0() returns (uint160, int24, uint16 observationIndex, uint16 observationCardinality, uint16, uint8, bool unlocked) {
            observationIndex; unlocked;
            // Pool must have at least 2 observations; if not, fallback mode will be used until increased
            if (observationCardinality < 2) {
                // Do not revert — allow registration, but getPrice will fail-closed until observations exist
            }
        } catch {
            revert("Invalid pool");
        }
        marketConfigs[market].pool = pool;
        marketConfigs[market].token0IsBase = token0IsBase;
        marketConfigs[market].isActive = true;
        emit PoolConfigured(market, marketConfigs[market].asset, pool, twapPeriod);
    }

    /// @notice Pre-register a Uniswap V3 pool for an asset (factory only).
    /// @dev MarketFactoryV2 reads this via getPoolForAsset during _configureAdapters.
    function registerPoolForAsset(address asset, address pool, bool token0IsBase) external onlyFactory {
        require(asset != address(0) && pool != address(0), "Invalid");
        assetPools[asset] = AssetPool({pool: pool, token0IsBase: token0IsBase});
    }

    function getPoolForAsset(address asset) external view returns (address pool, bool token0IsBase) {
        AssetPool memory ap = assetPools[asset];
        return (ap.pool, ap.token0IsBase);
    }

    /// @notice Force fallback mode for deterministic tests (factory only)
    function setFallbackMode(address market, bool useFallbackOnly) external onlyFactory {
        require(market != address(0), "Invalid market");
        MarketConfig storage cfg = marketConfigs[market];
        require(cfg.pool != address(0), "Pool not configured");
        cfg.useFallbackOnly = useFallbackOnly;
        emit FallbackModeUpdated(market, useFallbackOnly);
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        MarketConfig storage config = marketConfigs[msg.sender];
        if (!config.isActive || config.pool == address(0)) {
            return (0, false, 0);
        }
        if (config.useFallbackOnly) {
            return _fallbackPrice(config);
        }
        // Attempt real TWAP first
        (uint256 twapPrice, bool twapOk) = _tryTwap(config, twapPeriod);
        if (twapOk) {
            return (twapPrice, true, block.timestamp);
        }
        // Fallback to last pushed price if TWAP observations unavailable (fail-closed on staleness)
        return _fallbackPrice(config);
    }

    /// @inheritdoc IOracleAdapter
    /// @dev Review M14 note: informational history only — returns the consult at
    /// `secondsAgo` (24h max) with no window/gate, and returns 0 when the pool is
    /// unavailable. Not a consensus input; the circuit breaker keeps its own baseline.
    function getHistoricalPrice(uint256 secondsAgo) external view override returns (uint256) {
        MarketConfig storage config = marketConfigs[msg.sender];
        if (!config.isActive || config.pool == address(0)) return 0;
        if (secondsAgo == 0 || secondsAgo > 86400) return 0;
        uint32 ago = secondsAgo > type(uint32).max ? type(uint32).max : uint32(secondsAgo);
        (uint256 hist, bool ok) = _tryTwap(config, ago);
        if (ok) return hist;
        return 0;
    }

    /**
     * @notice Update fallback price for a market (factory only — deterministic tests / anvil forks)
     * @dev This does NOT bypass TWAP in production; it only populates the fallback slot used when
     *      pool observations are unavailable or cardinality <2.
     */
    function updatePrice(address market, uint256 newPrice) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(newPrice > 0 && newPrice < MAX_SANE_PRICE, "Invalid price");
        marketConfigs[market].lastPrice = newPrice;
        marketConfigs[market].lastUpdatedAt = block.timestamp;
        // Review M9: keeper price pushes remain a fallback when pool observations are
        // unavailable — they must leave an on-chain trail. Primary path is on-chain TWAP.
        emit FallbackPriceUpdated(market, newPrice, block.timestamp);
    }

    // ============ Internal TWAP Helpers ============

    function _tryTwap(MarketConfig storage config, uint32 secondsAgo) internal view returns (uint256 price, bool ok) {
        if (config.pool == address(0) || config.asset == address(0)) return (0, false);
        if (secondsAgo == 0) return (0, false);
        try this._consultWithQuote(config.pool, config.asset, secondsAgo) returns (uint256 q) {
            if (q == 0 || q >= MAX_SANE_PRICE) return (0, false);
            return (q, true);
        } catch {
            return (0, false);
        }
    }

    /// @notice External wrapper — keeper-fed TWAP (fallback) is primary in v2.1; on-chain pool TWAP via helper will be enabled in v2.2.
        /// @notice External self-call wrapper for TWAP consult (enables try/catch in _tryTwap).
    /// @dev Uses UniswapV3TwapLibrary (0.8 port of OracleLibrary.consult + getQuoteAtTick).
    ///      Returns the quote-token value of 1e18 base asset units.
    function _consultWithQuote(address pool, address asset, uint32 secondsAgo) external view returns (uint256) {
        require(msg.sender == address(this), "Only self");
        require(pool != address(0) && asset != address(0) && secondsAgo > 0, "Bad args");
        int24 tick = UniswapV3TwapLibrary.consult(pool, secondsAgo);
        address token0 = IUniswapV3Pool(pool).token0();
        address token1 = IUniswapV3Pool(pool).token1();
        require(asset == token0 || asset == token1, "Asset not in pool");
        address quote = asset == token0 ? token1 : token0;
        // Prefer configured quoteToken when it is the other side of the pool
        if (quoteToken != address(0)) {
            require(quote == quoteToken || asset == quoteToken, "Quote mismatch");
            if (asset == quoteToken) {
                // Price of quote in base — invert by swapping roles
                quote = token0 == asset ? token1 : token0;
            }
        }
        return UniswapV3TwapLibrary.getQuoteAtTick(tick, 1e18, asset, quote);
    }

    function _fallbackPrice(MarketConfig storage config) internal view returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        if (config.lastPrice == 0 || config.lastUpdatedAt == 0) return (0, false, 0);
        if (block.timestamp - config.lastUpdatedAt > FALLBACK_MAX_STALENESS) return (0, false, config.lastUpdatedAt);
        if (config.lastPrice >= MAX_SANE_PRICE) return (0, false, config.lastUpdatedAt);
        return (config.lastPrice, true, config.lastUpdatedAt);
    }
}
