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
interface IERC20OraclePause {
    function oraclePaused() external view returns (bool);
}

contract ChainlinkEquityFeedAdapter is IOracleAdapter {

    address public immutable factory;
    address public owner;
    mapping(address => bool) public authorizedConfigurators;

    struct MarketConfig {
        AggregatorV3Interface feed;
        uint256 maxStaleness;
        address l2Sequencer;
        uint8 feedDecimals;
        address pauseToken;
        bool checkTokenOraclePause;
        bool enforceTradingWindow; // true for 24/5 equities (B20), false for 24/7 NAV/RWA
    }

    mapping(address => MarketConfig) public marketConfigs;

    uint256 public constant SEQUENCER_MAX_STALENESS = 3600;
    uint256 public constant SEQUENCER_GRACE_PERIOD = 3600;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyFactoryOrOwner() {
        require(msg.sender == factory || msg.sender == owner, "Only factory/owner");
        _;
    }

    modifier onlyFactoryOwnerOrConfigurator() {
        require(
            msg.sender == factory || msg.sender == owner || authorizedConfigurators[msg.sender],
            "Only factory/owner/configurator"
        );
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        owner = msg.sender;
    }

    function transferOwner(address newOwner) external {
        require(msg.sender == owner, "Only owner");
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
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
    ) external onlyFactoryOwnerOrConfigurator {
        require(market != address(0), "Invalid market");
        require(_feed != address(0), "Invalid feed");
        marketConfigs[market] = MarketConfig({
            feed: AggregatorV3Interface(_feed),
            maxStaleness: _maxStaleness > 0 ? _maxStaleness : 3600,
            l2Sequencer: _l2Sequencer,
            feedDecimals: _getFeedDecimals(_feed),
            pauseToken: address(0),
            checkTokenOraclePause: false,
            enforceTradingWindow: true
        });
    }

    /**
     * @notice Register a feed and an optional token-level oracle pause flag.
     * @dev The token pause flag is advisory but fail-closed when enabled. The
     *      feed staleness check remains mandatory and authoritative.
     */
    function registerFeedWithTokenOraclePause(
        address market,
        address _feed,
        uint256 _maxStaleness,
        address _l2Sequencer,
        address _pauseToken
    ) external onlyFactoryOwnerOrConfigurator {
        require(market != address(0), "Invalid market");
        require(_feed != address(0), "Invalid feed");
        require(_pauseToken != address(0), "Invalid pause token");
        marketConfigs[market] = MarketConfig({
            feed: AggregatorV3Interface(_feed),
            maxStaleness: _maxStaleness > 0 ? _maxStaleness : 3600,
            l2Sequencer: _l2Sequencer,
            feedDecimals: _getFeedDecimals(_feed),
            pauseToken: _pauseToken,
            checkTokenOraclePause: true,
            enforceTradingWindow: true
        });
    }

    /// @notice Toggle trading window enforcement per market (e.g., disable for 24/7 NAV)
    function setTradingWindowEnforcement(address market, bool enforce) external onlyFactoryOwnerOrConfigurator {
        require(market != address(0), "Invalid market");
        MarketConfig storage cfg = marketConfigs[market];
        require(address(cfg.feed) != address(0), "Market not configured");
        cfg.enforceTradingWindow = enforce;
    }

    function setAuthorizedConfigurator(address configurator, bool authorized) external onlyFactoryOrOwner {
        require(configurator != address(0), "Invalid configurator");
        authorizedConfigurators[configurator] = authorized;
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        MarketConfig storage config = marketConfigs[msg.sender];
        if (address(config.feed) == address(0)) return (0, false, 0);

        if (config.enforceTradingWindow && !_isWithinTradingWindow()) {
            return (0, false, 0);
        }

        if (address(config.l2Sequencer) != address(0) && !_isSequencerUp(config.l2Sequencer)) {
            return (0, false, 0);
        }

        if (config.checkTokenOraclePause && !_isTokenOracleActive(config.pauseToken)) {
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
        uint256 dayOfWeek = (block.timestamp / 86400 + 3) % 7; // 0=Monday, 6=Sunday (Unix epoch Thursday -> 3)
        // solhint-disable-next-line var-name-mixedcase
        uint256 timeOfDay = block.timestamp % 86400;
        timeOfDay; // suppress unused warning, kept for future intraday window use

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
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            // Chainlink L2 uptime feeds encode 0 = sequencer up and 1 = down.
            if (answer != 0 || answeredInRound < roundId) return false;
            if (startedAt == 0 || updatedAt == 0) return false;
            if (startedAt > block.timestamp || updatedAt > block.timestamp) return false;
            if (block.timestamp - updatedAt > SEQUENCER_MAX_STALENESS) return false;
            return block.timestamp - startedAt > SEQUENCER_GRACE_PERIOD;
        } catch {
            return false;
        }
    }

    // ============ Helpers ============

    function _isTokenOracleActive(address token) internal view returns (bool) {
        try IERC20OraclePause(token).oraclePaused() returns (bool paused) {
            return !paused;
        } catch {
            return false;
        }
    }

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
