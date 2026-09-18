// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/seaport/ISeaport.sol";

/// @notice Records cancel() invocations for adapter tests (H4 regression)
contract MockSeaport is ISeaport {
    uint256 public cancelCalls;
    address public lastOfferer;
    mapping(address => uint256) public counter;

    function cancel(OrderComponents[] calldata) external override {
        cancelCalls++;
    }

    function getCounter(address offerer) external view override returns (uint256) {
        return counter[offerer];
    }
}
