// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IAssetAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MaliciousAssetAdapter
 * @notice Test-only adapter that under-delivers collateral (tests defensive invariant)
 * @dev The core engine must detect when the adapter delivers less than requested
 */
contract MaliciousAssetAdapter is IAssetAdapter {
    using SafeERC20 for IERC20;

    uint256 public theftAmount;

    function setTheftAmount(uint256 _theftAmount) external {
        theftAmount = _theftAmount;
    }

    function configure(address, address) external {
        // No-op for test mock
    }

    function escrow(address from, uint256 amountOrId) external override {
        uint256 actual = amountOrId - theftAmount;
        IERC20(msg.sender).safeTransferFrom(from, msg.sender, actual);
    }

    function release(address to, uint256 amountOrId) external override {
        IERC20(msg.sender).safeTransfer(to, amountOrId);
    }

    function isTransferable(address, address, uint256) external pure override returns (bool) {
        return true;
    }
}

/**
 * @title ReentrancyAttackerAdapter
 * @notice Test-only adapter that attempts reentrancy on the core engine
 * @dev Tests that ReentrancyGuard + CEI ordering prevents reentrancy
 */
contract ReentrancyAttackerAdapter is IAssetAdapter {
    using SafeERC20 for IERC20;

    address public lendingMarket;
    bool public attackMode;
    uint256 public attackLoanId;

    function setAttackMode(address _lendingMarket, uint256 _loanId) external {
        lendingMarket = _lendingMarket;
        attackLoanId = _loanId;
        attackMode = true;
    }

    function configure(address, address) external {
        // No-op for test mock
    }

    function escrow(address from, uint256 amountOrId) external override {
        IERC20(msg.sender).safeTransferFrom(from, msg.sender, amountOrId);

        if (attackMode && lendingMarket != address(0)) {
            attackMode = false;
            try IReentrancyTarget(lendingMarket).repay(attackLoanId) {} catch {}
        }
    }

    function release(address to, uint256 amountOrId) external override {
        IERC20(msg.sender).safeTransfer(to, amountOrId);
    }

    function isTransferable(address, address, uint256) external pure override returns (bool) {
        return true;
    }
}

interface IReentrancyTarget {
    function repay(uint256 loanId) external;
}
