// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IAssetAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ERC20Adapter
 * @notice Reference asset adapter for ERC20 collateral
 * @dev Implements IAssetAdapter with SafeERC20 for secure transfers.
 *      Stores the collateral token address at construction — never uses msg.sender as the token.
 *      Escrow pulls from borrower to market; release pulls from market to recipient.
 */
contract ERC20Adapter is IAssetAdapter {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken;

    constructor(address _collateralToken) {
        require(_collateralToken != address(0), "Invalid token");
        collateralToken = IERC20(_collateralToken);
    }

    /// @notice Escrow ERC20 collateral from borrower to the calling market
    function escrow(address from, uint256 amountOrId) external override {
        collateralToken.safeTransferFrom(from, msg.sender, amountOrId);
    }

    /// @notice Release ERC20 collateral from market to recipient
    function release(address to, uint256 amountOrId) external override {
        collateralToken.safeTransferFrom(msg.sender, to, amountOrId);
    }

    /// @notice Check if ERC20 transfer would succeed
    function isTransferable(address from, address to, uint256 amountOrId) external view override returns (bool) {
        if (from == address(0) || to == address(0)) return false;
        uint256 balance = collateralToken.balanceOf(from);
        uint256 allowance = collateralToken.allowance(from, address(this));
        return balance >= amountOrId && allowance >= amountOrId;
    }
}
