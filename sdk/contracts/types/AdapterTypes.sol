// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library AdapterTypes {
    struct PriceQuote {
        uint256 price;
        bool trusted;
        uint256 updatedAt;
    }

    struct LiquidationResult {
        uint256 recoveredForLP;
        uint256 returnedToHolder;
    }
}
