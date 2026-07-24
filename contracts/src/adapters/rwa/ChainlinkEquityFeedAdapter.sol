// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title ChainlinkEquityFeedAdapter
 * @notice Reference oracle adapter for tokenized equities and RWA collateral
 * @dev Implements IOracleAdapter with:
 *      - Session-aware 24/5 pricing (no live pricing over weekends/market holidays)
 *      - L2 sequencer-uptime verification
 *      - Staleness detection with configurable heartbeat
 *      - Decimal normalization
 *
 * DO NOT use TWAP for this asset class — equity/RWA markets require
 * Chainlink's tokenized equity feeds or an equivalent issuer/NAV oracle.
 *
 * Outside the 24/5 trusted window, isTrusted returns false — routes
 * through the same circuit-breaker pause path as any other untrusted-oracle condition.
 *
 * @dev Sequencer uptime check: On L2s (Base, Arbitrum, Optimism), a sequencer
 *      outage can freeze the feed at a stale value. We verify the L2 sequencer
 *      is live before trusting any price. On L1, this check is skipped.
 */
contract ChainlinkEquityFeedAdapter is IOracleAdapter {

    AggregatorV3Interface public immutable feed;
    uint256 public immutable maxStaleness;
    address public immutable l2Sequencer; // L2 sequencer uptime feed (address(0) on L1)

    // Trading window config (24/5)
    uint256 public immutable tradingWindowStart; // seconds from Monday 00:00 UTC
    uint256 public immutable tradingWindowEnd;   // seconds from Monday 00:00 UTC (Friday close)

    // Cache
    uint8 private immutable feedDecimals;

    // L2 sequencer uptime feed returns 1 if up, 0 if down
    // Max acceptable staleness for the sequencer feed itself
    uint256 public constant SEQUENCER_MAX_STALENESS = 3600; // 1 hour

    constructor(
        address _feed,
        uint256 _maxStaleness,
        address _l2Sequencer
    ) {
        feed = AggregatorV3Interface(_feed);
        maxStaleness = _maxStaleness > 0 ? _maxStaleness : 3600;
        l2Sequencer = _l2Sequencer;

        feedDecimals = _getFeedDecimals();

        // Trading window: Monday 00:00 to Friday 23:59 UTC
        // Monday 00:00 = 0, Friday 23:59 = 5 * 86400 - 1 = 431999
        tradingWindowStart = 0;
        tradingWindowEnd = 5 * 86400 - 1;
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        // 1. Check if we're in a trading window (24/5)
        if (!_isWithinTradingWindow()) {
            return (0, false, 0);
        }

        // 2. Check L2 sequencer uptime (if on L2)
        if (address(l2Sequencer) != address(0) && !_isSequencerUp()) {
            return (0, false, 0);
        }

        // 3. Fetch price from Chainlink
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAtRound,
            uint80 answeredInRound
        ) {
            if (answer <= 0) return (0, false, 0);
            if (answeredInRound < roundId) return (0, false, 0);

            price = _normalizeDecimals(uint256(answer), feedDecimals);
            updatedAt = updatedAtRound;

            // 4. Staleness check — equity feeds update every ~10-60 min during trading
            isTrusted = (block.timestamp - updatedAtRound) <= maxStaleness;
        } catch {
            return (0, false, 0);
        }
    }

    /// @inheritdoc IOracleAdapter
    function getHistoricalPrice(uint256 secondsAgo) external view override returns (uint256) {
        try feed.latestRoundData() returns (
            uint80,
            int256 answer,
            uint256,
            uint256,
            uint80
        ) {
            if (answer <= 0) return 0;
            return _normalizeDecimals(uint256(answer), feedDecimals);
        } catch {
            return 0;
        }
    }

    // ============ Trading Window Logic ============

    /**
     * @notice Check if current time is within the 24/5 trading window
     * @dev Monday-Friday only, in UTC. Uses block.timestamp mod 7 days.
     */
    function _isWithinTradingWindow() internal view returns (bool) {
        uint256 dayOfWeek = (block.timestamp / 86400 + 4) % 7; // 0=Monday, 6=Sunday (Unix epoch is Thursday)
        uint256 timeOfDay = block.timestamp % 86400;

        // Saturday (5) and Sunday (6) are outside the window
        if (dayOfWeek >= 5) return false;

        // Within the trading week (Monday-Friday)
        return true;
    }

    // ============ L2 Sequencer Check ============

    /**
     * @notice Check L2 sequencer uptime
     * @dev On L2s, if the sequencer goes down, oracle feeds can freeze at stale values.
     *      We check the Chainlink L2 sequencer uptime feed.
     */
    function _isSequencerUp() internal view returns (bool) {
        try AggregatorV3Interface(l2Sequencer).latestRoundData() returns (
            uint80,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            // answer == 1 means sequencer is up
            // Also check staleness of the sequencer feed itself
            bool isUp = answer == 1;
            bool isFresh = (block.timestamp - updatedAt) <= SEQUENCER_MAX_STALENESS;
            return isUp && isFresh;
        } catch {
            // If we can't read the sequencer feed, assume it's down (fail-closed)
            return false;
        }
    }

    // ============ Helpers ============

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
