// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title ChainlinkOracle
 * @notice Chainlink price feed integration
 */
library ChainlinkOracle {
    
    uint256 public constant MAX_PRICE_AGE = 3600;
    
    error InvalidPriceFeed();
    error StalePrice();
    error InvalidPrice();
    
    function getPrice(address priceFeed) 
        internal 
        view 
        returns (uint256 price, uint256 lastUpdate) 
    {
        if (priceFeed == address(0)) revert InvalidPriceFeed();
        
        AggregatorV3Interface feed = AggregatorV3Interface(priceFeed);
        
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();
        
        if (answer <= 0) revert InvalidPrice();
        if (updatedAt == 0) revert StalePrice();
        if (answeredInRound < roundId) revert StalePrice();
        
        if (block.timestamp - updatedAt > MAX_PRICE_AGE) {
            revert StalePrice();
        }
        
        uint8 decimals = feed.decimals();
        if (decimals < 18) {
            price = uint256(answer) * (10 ** (18 - decimals));
        } else {
            price = uint256(answer) / (10 ** (decimals - 18));
        }
        
        lastUpdate = updatedAt;
    }
    
    function validatePriceFeed(address priceFeed) 
        internal 
        view 
        returns (bool isValid) 
    {
        if (priceFeed == address(0)) return false;
        
        AggregatorV3Interface feed = AggregatorV3Interface(priceFeed);
        
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            if (answer <= 0) return false;
            if (updatedAt == 0) return false;
            if (answeredInRound < roundId) return false;
            if (block.timestamp - updatedAt > MAX_PRICE_AGE) return false;
            return true;
        } catch {
            return false;
        }
    }
}
