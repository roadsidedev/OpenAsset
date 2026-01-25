// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOracle {
    /**
     * @notice Gets the price of the asset in terms of the quote token (usually USDC or ETH)
     * @return price The price scaled by 1e18
     */
    function getPrice(address asset) external view returns (uint256);

    /**
     * @notice Checks if the price deviation between spot and TWAP is safe
     * @return safe True if deviation is within acceptable bounds
     */
    function isPriceSafe(address asset) external view returns (bool);
}
