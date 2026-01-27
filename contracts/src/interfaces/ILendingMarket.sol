// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./IMarketFactory.sol";

/**
 * @title ILendingMarket
 * @notice Interface for isolated lending market
 */
interface ILendingMarket {
    function depositLiquidity(uint256 amount) external returns (uint256 shares);
    function withdrawLiquidity(uint256 shares) external returns (uint256 amount);
    
    function requestLoan(
        uint256 collateralAmount,
        uint256 tokenId,
        uint256 erc1155Amount
    ) external returns (address loanContract);
    
    function getAvailableLiquidity() external view returns (uint256 available);
    function isCircuitBreakerTriggered() external view returns (bool isPaused);
    
    function removeLoan(address loanContract, uint256 principal) external;
    
    function getLoanConfig() external view returns (
        address collateralAsset,
        address loanAsset,
        address protocolTreasury,
        address oracle,
        AssetType assetType,
        uint256 healthFactorThreshold
    );
}
