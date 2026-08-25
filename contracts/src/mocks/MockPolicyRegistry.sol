// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPolicyRegistry {
    mapping(bytes32 => mapping(address => bool)) public authorized;

    function setAuthorized(bytes32 pid, address account, bool ok) external {
        authorized[pid][account] = ok;
    }

    function isAuthorized(bytes32 pid, address account) external view returns (bool) {
        return authorized[pid][account];
    }
}
