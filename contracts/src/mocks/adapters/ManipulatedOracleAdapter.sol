// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IOracleAdapter.sol";

/**
 * @title ManipulatedOracleAdapter
 * @notice Test-only oracle that returns manipulated prices
 * @dev Tests the engine's price bounds check and consistency verification
 */
contract ManipulatedOracleAdapter is IOracleAdapter {
    uint256 public currentPrice;
    bool public isTrustedStatus;
    uint256 public lastUpdatedAt;

    // If set, getPrice returns this price instead (manipulation)
    uint256 public manipulatedPrice;
    bool public manipulationActive;

    // Configurable: spike multiplier for testing price-bounds check
    uint256 public spikeMultiplier;

    constructor(uint256 _initialPrice, bool _trusted) {
        currentPrice = _initialPrice;
        isTrustedStatus = _trusted;
        lastUpdatedAt = block.timestamp;
    }

    function configure(address, address) external {
        // No-op for test mock
    }

    function setManipulation(uint256 _manipulatedPrice) external {
        manipulatedPrice = _manipulatedPrice;
        manipulationActive = true;
    }

    function setSpike(uint256 _spikeMultiplier) external {
        spikeMultiplier = _spikeMultiplier;
    }

    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        if (manipulationActive) {
            return (manipulatedPrice, isTrustedStatus, lastUpdatedAt);
        }
        if (spikeMultiplier > 0) {
            return (currentPrice * spikeMultiplier, isTrustedStatus, lastUpdatedAt);
        }
        return (currentPrice, isTrustedStatus, lastUpdatedAt);
    }

    function getHistoricalPrice(uint256) external view override returns (uint256) {
        return currentPrice;
    }
}
