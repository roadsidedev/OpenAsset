// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LendingMarketV2Handler} from "./LendingMarketV2Handler.sol";

/// @notice Aggregates fuzz entry points for the OpenAsset Market V2 core market
abstract contract Handlers is LendingMarketV2Handler {
    function setCurrentActor(uint256 entropy) public {
        actor = actors[entropy % actors.length];
    }
}
