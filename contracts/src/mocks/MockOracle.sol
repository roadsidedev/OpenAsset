// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IOracle.sol";

contract MockOracle is IOracle {
    mapping(address => uint256) public prices;
    bool public safe = true;

    function setPrice(address asset, uint256 price) external {
        prices[asset] = price;
    }

    function setSafe(bool _safe) external {
        safe = _safe;
    }

    function getPrice(address asset) external view returns (uint256) {
        return prices[asset];
    }

    function isPriceSafe(address asset) external view returns (bool) {
        return safe;
    }
}
