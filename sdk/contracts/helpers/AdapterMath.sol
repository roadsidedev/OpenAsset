// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../errors/AdapterErrors.sol";

library AdapterMath {
    uint256 internal constant WAD = 1e18;

    function requirePositive(uint256 value) internal pure returns (uint256) {
        if (value == 0) revert AdapterErrors.InvalidAmount();
        return value;
    }

    function requireTimestamp(uint256 timestamp) internal view returns (uint256) {
        if (timestamp == 0 || timestamp > block.timestamp) revert AdapterErrors.InvalidTimestamp();
        return timestamp;
    }

    function normalize(uint256 value, uint8 decimals) internal pure returns (uint256) {
        if (decimals == 18) return value;
        if (decimals < 18) return value * (10 ** (18 - decimals));
        return value / (10 ** (decimals - 18));
    }
}
