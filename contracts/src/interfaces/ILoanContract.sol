// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title ILoanContract
 * @notice Interface for individual loan escrow contract
 */
interface ILoanContract {
    enum LoanStatus { ACTIVE, REPAID, LIQUIDATED, DEFAULTED }
    
    function initialize(
        address borrower_,
        uint256 collateralAmount_,
        uint256 tokenId_,
        uint256 erc1155Amount_,
        uint256 principal_,
        uint256 interestAmount_,
        uint256 expiryTime_
    ) external;
    
    function repay() external;
    function liquidate() external;
    
    function getHealthFactor() external view returns (uint256 healthFactor);
    function isLiquidatable() external view returns (bool canLiquidate);
    
    function getLoanDetails() external view returns (
        address borrower,
        uint256 principal,
        uint256 interestAmount,
        uint256 collateralAmount,
        uint256 tokenId,
        uint256 startTime,
        uint256 expiryTime,
        LoanStatus status,
        uint256 healthFactor
    );
}
