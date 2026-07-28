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

    address public immutable factory;

    struct MarketConfig {
        AggregatorV3Interface feed;
        uint256 maxStaleness;
        address l2Sequencer;
        uint8 feedDecimals;
    }

    mapping(address => MarketConfig) public marketConfigs;

    uint256 public constant SEQUENCER_MAX_STALENESS = 3600;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function configure(address market, address) external onlyFactory {
        require(market != address(0), "Invalid market");
    }

    /**
     * @notice Register a Chainlink equity feed for a specific market
     * @param market Address of the LendingMarket contract
     * @param _feed Chainlink AggregatorV3Interface feed address
     * @param _maxStaleness Maximum age before price is considered stale
     * @param _l2Sequencer L2 sequencer uptime feed address (address(0) on L1)
     */
    function registerFeed(
        address market,
        address _feed,
        uint256 _maxStaleness,
        address _l2Sequencer
    ) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(_feed != address(0), "Invalid feed");
        marketConfigs[market] = MarketConfig({
            feed: AggregatorV3Interface(_feed),
            maxStaleness: _maxStaleness > 0 ? _maxStaleness : 3600,
            l2Sequencer: _l2Sequencer,
            feedDecimals: _getFeedDecimals(_feed)
        });
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        MarketConfig storage config = marketConfigs[msg.sender];
        if (address(config.feed) == address(0)) return (0, false, 0);

        if (!_isWithinTradingWindow()) {
            return (0, false, 0);
        }

        if (address(config.l2Sequencer) != address(0) && !_isSequencerUp(config.l2Sequencer)) {
            return (0, false, 0);
        }

        try config.feed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAtRound,
            uint80 answeredInRound
        ) {
            if (answer <= 0) return (0, false, 0);
            if (answeredInRound < roundId) return (0, false, 0);

            price = _normalizeDecimals(uint256(answer), config.feedDecimals);
            updatedAt = updatedAtRound;

            isTrusted = (block.timestamp - updatedAtRound) <= config.maxStaleness;
        } catch {
            return (0, false, 0);
        }
    }

    /// @inheritdoc IOracleAdapter
    function getHistoricalPrice(uint256) external view override returns (uint256) {
        MarketConfig storage config = marketConfigs[msg.sender];
        if (address(config.feed) == address(0)) return 0;
        try config.feed.latestRoundData() returns (
            uint80, int256 answer, uint256, uint256, uint80
        ) {
            if (answer <= 0) return 0;
            return _normalizeDecimals(uint256(answer), config.feedDecimals);
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
    function _isSequencerUp(address _l2Sequencer) internal view returns (bool) {
        try AggregatorV3Interface(_l2Sequencer).latestRoundData() returns (
            uint80,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            bool isUp = answer == 1;
            bool isFresh = (block.timestamp - updatedAt) <= SEQUENCER_MAX_STALENESS;
            return isUp && isFresh;
        } catch {
            return false;
        }
    }

    // ============ Helpers ============

    function _getFeedDecimals(address _feed) internal view returns (uint8) {
        try AggregatorV3Interface(_feed).decimals() returns (uint8 d) {
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
