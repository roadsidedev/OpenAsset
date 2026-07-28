// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/ILiquidationAdapter.sol";

/**
 * @title MockLiquidationAdapter
 * @notice Test-only liquidation adapter with configurable behavior
 * @dev Implements ILiquidationAdapter for testing the core engine.
 *      Supports both synchronous and async modes.
 */
contract MockLiquidationAdapter is ILiquidationAdapter {
    bool public isAsync;
    uint256 public cureWindow;
    uint256 public mockRecoveredForLP;
    uint256 public mockReturnedToHolder;
    uint256 public lastLiquidatedLoanId;
    uint256 public lastDebtOwed;
    uint256 public liquidationCount;
    bool public shouldRevert;
    string public revertMessage;

    event Liquidated(uint256 indexed loanId, uint256 debtOwed, uint256 recoveredForLP, uint256 returnedToHolder);

    constructor(bool _isAsync, uint256 _cureWindow) {
        isAsync = _isAsync;
        cureWindow = _cureWindow;
    }

    function configure(address, address) external {
        // No-op for test mock
    }

    function setMockReturns(uint256 _recoveredForLP, uint256 _returnedToHolder) external {
        mockRecoveredForLP = _recoveredForLP;
        mockReturnedToHolder = _returnedToHolder;
    }

    function setRevert(bool _shouldRevert, string calldata _message) external {
        shouldRevert = _shouldRevert;
        revertMessage = _message;
    }

    function liquidate(uint256 loanId, uint256 debtOwed)
        external
        override
        returns (uint256 recoveredForLP, uint256 returnedToHolder)
    {
        if (shouldRevert) {
            revert(revertMessage);
        }

        lastLiquidatedLoanId = loanId;
        lastDebtOwed = debtOwed;
        liquidationCount++;

        recoveredForLP = mockRecoveredForLP;
        returnedToHolder = mockReturnedToHolder;

        emit Liquidated(loanId, debtOwed, recoveredForLP, returnedToHolder);
    }

    function isAsynchronous() external view override returns (bool) {
        return isAsync;
    }

    function cureWindowSeconds() external view override returns (uint256) {
        return cureWindow;
    }
}
