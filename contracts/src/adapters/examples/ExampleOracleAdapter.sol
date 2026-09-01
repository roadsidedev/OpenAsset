// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";

/**
 * @title ExampleOracleAdapter
 * @notice Minimal reference implementation for adapter developers.
 * @dev This adapter is a documentation and local-test fixture, not a production
 *      oracle. The factory configures each market and may set a deterministic
 *      quote for that market. It has no external dependencies and is deliberately
 *      non-upgradeable.
 */
contract ExampleOracleAdapter is IOracleAdapter {
    uint8 public constant ADAPTER_MAJOR = 1;
    uint8 public constant ADAPTER_MINOR = 0;
    uint8 public constant ADAPTER_PATCH = 0;

    address public immutable factory;

    struct MarketConfig {
        address asset;
        uint256 price;
        uint256 updatedAt;
        bool trusted;
        bool configured;
    }

    mapping(address => MarketConfig) public marketConfigs;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    /// @inheritdoc IOracleAdapter
    function configure(address market, address asset) external override onlyFactory {
        require(market != address(0), "Invalid market");
        require(asset != address(0), "Invalid asset");
        marketConfigs[market] = MarketConfig({
            asset: asset,
            price: 0,
            updatedAt: 0,
            trusted: false,
            configured: true
        });
    }

    /**
     * @notice Set the fixed quote used by a configured market.
     * @dev Factory-only access models the controlled configuration step used by
     *      production adapters. `trusted` must be explicitly supplied so a new
     *      market cannot accidentally consume an unreviewed quote.
     * @param market Configured LendingMarket address
     * @param price USD price with 18 decimals
     * @param updatedAt Source observation timestamp
     * @param trusted Whether the quote passes the adapter's trust checks
     */
    function setQuote(address market, uint256 price, uint256 updatedAt, bool trusted)
        external
        onlyFactory
    {
        MarketConfig storage config = marketConfigs[market];
        require(config.configured, "Unconfigured market");
        require(price > 0, "Invalid price");
        require(updatedAt > 0 && updatedAt <= block.timestamp, "Invalid timestamp");
        config.price = price;
        config.updatedAt = updatedAt;
        config.trusted = trusted;
    }

    /// @inheritdoc IOracleAdapter
    function getPrice()
        external
        view
        override
        returns (uint256 price, bool isTrusted, uint256 updatedAt)
    {
        MarketConfig memory config = marketConfigs[msg.sender];
        require(config.configured, "Unconfigured market");
        return (config.price, config.trusted && config.price > 0 && config.updatedAt > 0, config.updatedAt);
    }

    /// @inheritdoc IOracleAdapter
    function getHistoricalPrice(uint256) external pure override returns (uint256) {
        // This fixture has no historical source. Returning the latest quote would
        // violate the interface's historical-price contract.
        return 0;
    }
}
