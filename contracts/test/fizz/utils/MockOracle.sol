// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IOracleAdapterMock {
    function getPrice() external view returns (uint256 price, bool isTrusted, uint256 updatedAt);
    function getHistoricalPrice(uint256 secondsAgo) external view returns (uint256);
}

contract MockOracle is IOracleAdapterMock {
    uint256 public constant PRICE = 1000e18;
    uint256 public lastUpdate;

    constructor() {
        lastUpdate = block.timestamp;
    }

    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        return (PRICE, true, lastUpdate);
    }

    function getHistoricalPrice(uint256) external view override returns (uint256) {
        return PRICE;
    }
}
