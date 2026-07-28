// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IAssetAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockAssetAdapter
 * @notice Test-only asset adapter for ERC20 collateral
 * @dev Implements IAssetAdapter with simple escrow/release via SafeERC20
 */
contract MockAssetAdapter is IAssetAdapter {
    using SafeERC20 for IERC20;

    address public collateralToken;
    mapping(address => address) public marketTokens;

    function configure(address market, address _collateralToken) external {
        marketTokens[market] = _collateralToken;
        collateralToken = _collateralToken;
    }

    // Configurable: if true, escrow will under-deliver (for testing defensive invariants)
    bool public shouldUnderDeliver;
    uint256 public underDeliveryAmount;

    event Escrowed(address indexed from, uint256 amount);
    event Released(address indexed to, uint256 amount);

    constructor(address _collateralToken) {
        collateralToken = _collateralToken;
    }

    function setUnderDeliver(bool enabled, uint256 amount) external {
        shouldUnderDeliver = enabled;
        underDeliveryAmount = amount;
    }

    function escrow(address from, uint256 amountOrId) external override {
        uint256 actualAmount = shouldUnderDeliver ? amountOrId - underDeliveryAmount : amountOrId;
        IERC20(collateralToken).safeTransferFrom(from, msg.sender, actualAmount);
        emit Escrowed(from, actualAmount);
    }

    function release(address to, uint256 amountOrId) external override {
        // Transfer from the calling contract (market) to the recipient
        IERC20(collateralToken).safeTransferFrom(msg.sender, to, amountOrId);
        emit Released(to, amountOrId);
    }

    function isTransferable(address from, address to, uint256 amountOrId) external view override returns (bool) {
        if (from == address(0) || to == address(0)) return false;
        uint256 balance = IERC20(collateralToken).balanceOf(from);
        // Check allowance from user to this adapter (since this adapter executes the transfer)
        uint256 allowance = IERC20(collateralToken).allowance(from, address(this));
        return balance >= amountOrId && allowance >= amountOrId;
    }
}
