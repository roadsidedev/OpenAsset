// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title ChainlinkAdapter
 * @notice Multi-tenant oracle adapter wrapping a Chainlink price feed
 * @dev Implements IOracleAdapter with staleness detection and decimal normalization.
 *      Multi-tenancy: factory calls configure() once per market, storing the feed
 *      address for that market. A single instance can serve assets with different feeds.
 */
contract ChainlinkAdapter is IOracleAdapter {

    address public immutable factory;

    struct MarketConfig {
        AggregatorV3Interface feed;
        uint256 maxStaleness;
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

    function configure(address market, address asset) external onlyFactory {
        require(market != address(0), "Invalid market");
        // Asset is not stored directly — the factory passes it for interface uniformity.
        // The MarketFactory calls configure() which routes via feed address set externally.
        // Concrete Chainlink oracle feed addresses are registered per-asset via registerFeed().
    }

    /**
     * @notice Register a Chainlink feed for a specific market
     * @param market Address of the LendingMarket contract
     * @param feedAddress Chainlink AggregatorV3Interface feed address
     * @param maxStalenessSeconds Maximum age before price is considered stale
     */
    function registerFeed(address market, address feedAddress, uint256 maxStalenessSeconds) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(feedAddress != address(0), "Invalid feed");
        marketConfigs[market] = MarketConfig({
            feed: AggregatorV3Interface(feedAddress),
            maxStaleness: maxStalenessSeconds > 0 ? maxStalenessSeconds : 3600
        });
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        MarketConfig memory config = marketConfigs[msg.sender];
        if (address(config.feed) == address(0)) return (0, false, 0);

        try config.feed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAtRound,
            uint80 answeredInRound
        ) {
            if (answer <= 0) return (0, false, 0);
            if (answeredInRound < roundId) return (0, false, 0);

            uint8 decimals = _getFeedDecimals(config.feed);
            price = _normalizeDecimals(uint256(answer), decimals);
            updatedAt = updatedAtRound;
            isTrusted = (block.timestamp - updatedAtRound) <= config.maxStaleness;
        } catch {
            return (0, false, 0);
        }
    }

    /// @inheritdoc IOracleAdapter
    function getHistoricalPrice(uint256) external view override returns (uint256) {
        MarketConfig memory config = marketConfigs[msg.sender];
        if (address(config.feed) == address(0)) return 0;
        (, int256 answer,,,) = config.feed.latestRoundData();
        if (answer <= 0) return 0;
        return _normalizeDecimals(uint256(answer), _getFeedDecimals(config.feed));
    }

    function _getFeedDecimals(AggregatorV3Interface _feed) internal view returns (uint8) {
        try _feed.decimals() returns (uint8 d) {
            return d;
        } catch {
            return 8;
        }
    }

    function _normalizeDecimals(uint256 value, uint8 decimals) internal pure returns (uint256) {
        if (decimals == 18) return value;
        if (decimals > 18) return value / (10 ** (decimals - 18));
        return value * (10 ** (18 - decimals));
    }
}
