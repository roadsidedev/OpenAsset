// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title ChainlinkAdapter
 * @notice Reference oracle adapter wrapping a Chainlink price feed
 * @dev Implements IOracleAdapter with staleness detection and decimal normalization
 *
 * One adapter instance per asset. The feed address is set at construction.
 * isTrusted returns false if the feed is stale (> 1 hour since last update)
 * or returns a non-positive price.
 */
contract ChainlinkAdapter is IOracleAdapter {

    AggregatorV3Interface public immutable feed;
    uint256 public immutable maxStaleness;

    constructor(address _feed, uint256 _maxStaleness) {
        feed = AggregatorV3Interface(_feed);
        maxStaleness = _maxStaleness > 0 ? _maxStaleness : 3600;
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAtRound,
            uint80 answeredInRound
        ) {
            if (answer <= 0) return (0, false, 0);
            if (answeredInRound < roundId) return (0, false, 0);

            uint8 decimals = _getFeedDecimals();
            price = _normalizeDecimals(uint256(answer), decimals);
            updatedAt = updatedAtRound;
            isTrusted = (block.timestamp - updatedAtRound) <= maxStaleness;
        } catch {
            return (0, false, 0);
        }
    }

    /// @inheritdoc IOracleAdapter
    function getHistoricalPrice(uint256 secondsAgo) external view override returns (uint256) {
        (, int256 answer,,,) = feed.latestRoundData();
        if (answer <= 0) return 0;
        return _normalizeDecimals(uint256(answer), _getFeedDecimals());
    }

    function _getFeedDecimals() internal view returns (uint8) {
        try feed.decimals() returns (uint8 d) {
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
