// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";

/**
 * @title MockOracleAdapter
 * @notice Test-only oracle adapter with settable price and trust status
 * @dev Implements IOracleAdapter for testing the core engine
 */
contract MockOracleAdapter is IOracleAdapter {
    uint256 public currentPrice;
    bool public isTrustedStatus;
    uint256 public lastUpdatedAt;

    // Configurable: if true, getPrice will revert (for testing fallback/pause)
    bool public shouldRevert;
    string public revertMessage;

    // Configurable: historical prices (secondsAgo => price)
    mapping(uint256 => uint256) public historicalPrices;

    // Configurable: price change between consecutive reads (for testing price-bounds check)
    bool public enforcePriceConsistency;
    uint256 public lastReturnedPrice;

    event PriceSet(uint256 price, bool isTrusted);
    event TrustStatusSet(bool isTrusted);

    constructor(uint256 _initialPrice, bool _initialTrusted) {
        currentPrice = _initialPrice;
        isTrustedStatus = _initialTrusted;
        lastUpdatedAt = block.timestamp;
    }

    function setPrice(uint256 _price) external {
        currentPrice = _price;
        lastUpdatedAt = block.timestamp;
        emit PriceSet(_price, isTrustedStatus);
    }

    function setTrusted(bool _trusted) external {
        isTrustedStatus = _trusted;
        emit TrustStatusSet(_trusted);
    }

    function setRevert(bool _shouldRevert, string calldata _message) external {
        shouldRevert = _shouldRevert;
        revertMessage = _message;
    }

    function setHistoricalPrice(uint256 _secondsAgo, uint256 _price) external {
        historicalPrices[_secondsAgo] = _price;
    }

    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        if (shouldRevert) {
            revert(revertMessage);
        }
        return (currentPrice, isTrustedStatus, lastUpdatedAt);
    }

    function getHistoricalPrice(uint256 secondsAgo) external view override returns (uint256) {
        if (shouldRevert) {
            revert(revertMessage);
        }
        return historicalPrices[secondsAgo];
    }
}
