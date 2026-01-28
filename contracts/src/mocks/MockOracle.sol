// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../interfaces/IOracle.sol";

/**
 * @title MockOracle
 * @notice Mock oracle for testing, implements unified IOracle interface
 */
contract MockOracle is IOracle {
    mapping(address => uint256) public prices;
    mapping(address => uint256) public lastUpdates;
    mapping(address => bool) public supported;
    bool public safe = true;

    /**
     * @notice Set price for an asset
     * @param asset Asset address
     * @param price Price with 18 decimals
     */
    function setPrice(address asset, uint256 price) external {
        prices[asset] = price;
        lastUpdates[asset] = block.timestamp;
        if (price > 0) {
            supported[asset] = true;
        }
    }

    /**
     * @notice Toggle safety flag
     * @param _safe Safety flag
     */
    function setSafe(bool _safe) external {
        safe = _safe;
    }

    /**
     * @notice Get price (IOracle interface)
     * @param asset Asset address
     * @return price Price with 18 decimals
     * @return decimals Always 18
     */
    function getPrice(address asset) 
        external 
        view 
        override 
        returns (uint256 price, uint8 decimals) 
    {
        require(safe, "MockOracle: unsafe");
        return (prices[asset], 18);
    }

    /**
     * @notice Get last update timestamp
     * @param asset Asset address
     * @return timestamp Timestamp of last update
     */
    function getLastUpdate(address asset) 
        external 
        view 
        override 
        returns (uint256 timestamp) 
    {
        return lastUpdates[asset];
    }

    /**
     * @notice Check if asset is supported
     * @param asset Asset address
     * @return Whether asset is supported
     */
    function supportsAsset(address asset) 
        external 
        view 
        override 
        returns (bool) 
    {
        return supported[asset];
    }

    /**
     * @notice Get oracle type
     * @return Type string
     */
    function oracleType() 
        external 
        pure 
        override 
        returns (string memory) 
    {
        return "MOCK";
    }

    /**
     * @notice Check if oracle is in safe state (testing utility)
     * @return Whether oracle is safe
     */
    function isPriceSafe() external view returns (bool) {
        return safe;
    }
}
