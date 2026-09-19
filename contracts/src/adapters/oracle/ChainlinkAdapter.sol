// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title ChainlinkAdapter
 * @notice Multi-tenant oracle adapter wrapping Chainlink price feeds with L2 sequencer support
 * @dev Implements IOracleAdapter with staleness detection, decimal normalization and an
 *      optional L2 Sequencer Uptime Feed check (Base, OP, Arbitrum, etc.).
 *
 *      Feeds are registered PER ASSET by the owner via registerFeed(). The MarketFactory
 *      calls configure(market, asset) at market creation, which records the asset for the
 *      market. getPrice() resolves the asset's current feed dynamically, so feed updates
 *      propagate to all existing markets automatically.
 *
 *      If the L2 sequencer feed is configured, getPrice() returns isTrusted=false while the
 *      sequencer is down or during the grace period after it comes back up.
 */
contract ChainlinkAdapter is IOracleAdapter {

    address public immutable factory;
    address public owner;

    struct FeedConfig {
        AggregatorV3Interface feed;
        uint256 maxStaleness;
    }

    /// @notice collateral asset => price feed configuration (set by owner)
    mapping(address => FeedConfig) public assetFeeds;

    /// @notice market => collateral asset (set by factory via configure())
    mapping(address => address) public marketAssets;

    /// @notice Optional L2 Sequencer Uptime Feed (address(0) disables the check)
    AggregatorV3Interface public l2SequencerFeed;

    /// @notice Seconds to wait after the sequencer comes back up before trusting prices
    uint256 public constant SEQUENCER_GRACE_PERIOD = 3600;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    event FeedRegistered(address indexed asset, address indexed feed, uint256 maxStalenessSeconds);
    event FeedUnregistered(address indexed asset);
    event SequencerFeedSet(address indexed sequencerFeed);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address _factory, address _owner) {
        require(_factory != address(0), "Invalid factory");
        require(_owner != address(0), "Invalid owner");
        factory = _factory;
        owner = _owner;
    }

    /**
     * @notice Register (or update) the Chainlink price feed for a collateral asset
     * @param asset Collateral token address
     * @param feedAddress Chainlink AggregatorV3Interface proxy address
     * @param maxStalenessSeconds Maximum age before the price is considered stale
     */
    function registerFeed(address asset, address feedAddress, uint256 maxStalenessSeconds) external onlyOwner {
        require(asset != address(0), "Invalid asset");
        require(feedAddress != address(0), "Invalid feed");
        require(maxStalenessSeconds <= 2 days, "maxStaleness too high");
        assetFeeds[asset] = FeedConfig({
            feed: AggregatorV3Interface(feedAddress),
            maxStaleness: maxStalenessSeconds > 0 ? maxStalenessSeconds : 3600
        });
        emit FeedRegistered(asset, feedAddress, maxStalenessSeconds);
    }

    /**
     * @notice Remove the price feed for a collateral asset
     */
    function unregisterFeed(address asset) external onlyOwner {
        delete assetFeeds[asset];
        emit FeedUnregistered(asset);
    }

    /**
     * @notice Set (or clear with address(0)) the L2 Sequencer Uptime Feed
     * @dev On L2s with a published sequencer feed (Base mainnet, OP, Arbitrum) this
     *      guards against stale prices during sequencer outages. Testnets that do not
     *      publish a sequencer feed can leave this unset — the check is skipped.
     */
    function setL2SequencerFeed(address sequencerFeedAddress) external onlyOwner {
        l2SequencerFeed = AggregatorV3Interface(sequencerFeedAddress);
        emit SequencerFeedSet(sequencerFeedAddress);
    }

    /**
     * @notice Transfer owner role to a new address
     */
    function transferOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @dev Factory calls this once per market. Records the collateral asset so getPrice()
     *      can resolve the current feed for that asset dynamically.
     */
    function configure(address market, address asset) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(asset != address(0), "Invalid asset");
        marketAssets[market] = asset;
    }

    /// @inheritdoc IOracleAdapter
    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        address asset = marketAssets[msg.sender];
        FeedConfig memory config = assetFeeds[asset];
        if (address(config.feed) == address(0)) return (0, false, 0);

        // 1. L2 sequencer liveness check (optional)
        if (address(l2SequencerFeed) != address(0)) {
            try l2SequencerFeed.latestRoundData() returns (
                uint80 roundId,
                int256 answer,
                uint256 startedAt,
                uint256,
                uint80 answeredInRound
            ) {
                if (answer == 1) return (0, false, 0); // sequencer down
                if (answeredInRound < roundId) return (0, false, 0);
                if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) return (0, false, 0);
            } catch {
                return (0, false, 0);
            }
        }

        // 2. Price feed read with staleness detection
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
    function getHistoricalPrice(uint256 secondsAgo) external view override returns (uint256) {
        address asset = marketAssets[msg.sender];
        FeedConfig memory config = assetFeeds[asset];
        if (address(config.feed) == address(0)) return 0;

        // Apply the same L2 sequencer gate as getPrice
        if (address(l2SequencerFeed) != address(0)) {
            try l2SequencerFeed.latestRoundData() returns (
                uint80 roundId,
                int256 answer,
                uint256 startedAt,
                uint256,
                uint80 answeredInRound
            ) {
                if (answer == 1) return 0;
                if (answeredInRound < roundId) return 0;
                if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) return 0;
            } catch {
                return 0;
            }
        }

        // secondsAgo == 0 → latest round, but ONLY if still within maxStaleness
        if (secondsAgo == 0) {
            try config.feed.latestRoundData() returns (
                uint80 roundId,
                int256 answer,
                uint256,
                uint256 updatedAtRound,
                uint80 answeredInRound
            ) {
                if (answer <= 0) return 0;
                if (answeredInRound < roundId) return 0;
                if (updatedAtRound == 0 || block.timestamp < updatedAtRound) return 0;
                if (block.timestamp - updatedAtRound > config.maxStaleness) return 0;
                return _normalizeDecimals(uint256(answer), _getFeedDecimals(config.feed));
            } catch {
                return 0;
            }
        }

        // Walk rounds backward to find a price at or before (now - secondsAgo).
        // Do NOT silently return unchecked latest as "historical".
        if (secondsAgo > block.timestamp) return 0;
        uint256 targetTimestamp = block.timestamp - secondsAgo;

        uint80 latestRoundId;
        try config.feed.latestRoundData() returns (uint80 rid, int256, uint256, uint256, uint80) {
            latestRoundId = rid;
        } catch {
            return 0;
        }

        // Bound gas: walk at most 50 rounds
        uint80 maxWalk = 50;
        for (uint80 i = 0; i < maxWalk; i++) {
            if (latestRoundId < i) break;
            uint80 roundId = latestRoundId - i;
            try config.feed.getRoundData(roundId) returns (
                uint80 id,
                int256 answer,
                uint256,
                uint256 updatedAt,
                uint80 answeredInRound
            ) {
                if (answer <= 0) continue;
                if (answeredInRound < id) continue;
                if (updatedAt == 0) continue;
                if (updatedAt > targetTimestamp) continue; // still too recent — keep walking
                // Round is at or before target. Reject if that round is stale vs target.
                if (targetTimestamp - updatedAt > config.maxStaleness) return 0;
                return _normalizeDecimals(uint256(answer), _getFeedDecimals(config.feed));
            } catch {
                continue;
            }
        }
        return 0;
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
