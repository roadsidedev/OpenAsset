// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOracleAdapter
 * @notice Handles pricing for the lending engine
 * @dev Implementations: UniswapV3TWAPAdapter, ChainlinkAdapter, ChainlinkEquityFeedAdapter,
 *      NAVOracleAdapter, ManualOracleAdapter
 *
 * The engine calls getPrice() to get the current price and trusts the isTrusted
 * signal to decide whether to act on it. The engine does not need to know WHY
 * a price is untrusted (weekend gap, sequencer outage, staleness) — only whether
 * to pause via the circuit breaker.
 */
interface IOracleAdapter {
    /**
     * @notice Get the current price and trust status
     * @dev isTrusted covers staleness, sequencer-liveness (on L2s), AND
     *      session-awareness (e.g., equity feeds outside trading windows).
     *      The engine rejects any price where isTrusted == false.
     * @return price Price in USD with 18 decimals (1e18 = $1.00)
     * @return isTrusted Whether the price is currently reliable
     * @return updatedAt Unix timestamp of the last price update
     */
    function getPrice() external view returns (uint256 price, bool isTrusted, uint256 updatedAt);

    /**
     * @notice Get a historical price from a given number of seconds ago
     * @dev Used by the circuit breaker to calculate price volatility
     *      over the lookback window. Must return the price that was
     *      current at (block.timestamp - secondsAgo), or 0 if unavailable.
     * @param secondsAgo How many seconds back to query
     * @return price Historical price with 18 decimals, or 0 if unavailable
     */
    function getHistoricalPrice(uint256 secondsAgo) external view returns (uint256);
}
