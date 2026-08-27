// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILiquidationAdapterCaller {
    function liquidate(uint256 loanId, uint256 debtOwed) external returns (uint256, uint256);
}

contract MockLiquidationMarket {
    address public immutable collateralAsset;
    address public immutable lendingAsset;
    address public positionHolder;
    uint256 public collateralAmount;
    bool public oracleTrusted = true;
    uint256 public minimumOutput;

    constructor(address collateralToken, address lendingToken, address holder) {
        collateralAsset = collateralToken;
        lendingAsset = lendingToken;
        positionHolder = holder;
    }

    function setLoan(uint256 amount, address holder) external {
        collateralAmount = amount;
        positionHolder = holder;
    }

    function setQuote(uint256 output, bool trusted) external {
        minimumOutput = output;
        oracleTrusted = trusted;
    }

    function getLoanDetails(uint256) external view returns (
        uint256, uint256, uint256, uint256, uint256, uint8, uint256, address
    ) {
        return (collateralAmount, 0, 0, 0, 0, 1, 0, positionHolder);
    }

    function getLiquidationMinOutput(uint256, uint256 debtOwed, uint16)
        external view returns (uint256, bool)
    {
        return (minimumOutput > debtOwed ? minimumOutput : debtOwed, oracleTrusted);
    }

    function invokeLiquidation(address adapter, uint256 loanId, uint256 debtOwed)
        external returns (uint256 recoveredForLP, uint256 returnedToHolder)
    {
        return ILiquidationAdapterCaller(adapter).liquidate(loanId, debtOwed);
    }

    function fund(address token, address to, uint256 amount) external {
        require(IERC20(token).transfer(to, amount), "fund failed");
    }
}
