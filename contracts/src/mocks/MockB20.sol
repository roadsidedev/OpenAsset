// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockB20
 * @notice Minimal B20-like token for testing B20 adapters
 * @dev Implements ERC20 + B20 policy slots + pause surface.
 */
contract MockB20 is ERC20 {
    bytes32 public constant TRANSFER_SENDER_POLICY = bytes32(uint256(0xd116fc21));
    bytes32 public constant TRANSFER_RECEIVER_POLICY = bytes32(uint256(0x210f521b));
    bytes32 public constant TRANSFER_EXECUTOR_POLICY = bytes32(uint256(0x724e9c53));

    mapping(bytes32 => uint64) public policyIds;
    mapping(uint64 => mapping(address => bool)) public authorized;
    bool public pausedTransfers;

    uint256 public mockMultiplier = 1e18;
    uint8 private _decimalsCustom = 18;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        // default: policyId == 0 (always-allow)
    }

    function policyId(bytes32 scope) external view returns (uint64) {
        return policyIds[scope];
    }

    function setPolicyId(bytes32 scope, uint64 pid) external {
        policyIds[scope] = pid;
    }

    function setAuthorized(uint64 pid, address account, bool ok) external {
        authorized[pid][account] = ok;
    }

    function isAuthorized(uint64 pid, address account) external view returns (bool) {
        // helper for registry mock compat
        return authorized[pid][account];
    }

    function isPaused(bytes32) external view returns (bool) {
        return pausedTransfers;
    }

    function setPaused(bool p) external { pausedTransfers = p; }

    // B20 multiplier helpers
    function multiplier() external view returns (uint256) { return mockMultiplier; }
    function setMultiplier(uint256 m) external { mockMultiplier = m; }
    function scaledBalanceOf(address a) external view returns (uint256) {
        return (balanceOf(a) * mockMultiplier) / 1e18;
    }
    function toScaledBalance(uint256 raw) external view returns (uint256) { return (raw * mockMultiplier)/1e18; }
    function WAD_PRECISION() external pure returns (uint256) { return 1e18; }

    function mint(address to, uint256 amt) external { _mint(to, amt); }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) {
            require(!pausedTransfers, "B20 transfers paused");
        }
        super._beforeTokenTransfer(from, to, amount);
    }
}
