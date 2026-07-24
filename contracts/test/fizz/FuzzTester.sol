// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Handlers} from "./handlers/Handlers.sol";

/// @notice Entry point for Echidna/Medusa fuzzing
contract FuzzTester is Handlers {
    constructor() payable {
        setup();
    }
}
