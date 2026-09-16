// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface ILiquidationAdapterCaller {
    function liquidate(uint256 loanId, uint256 debtOwed) external returns (uint256, uint256);
}

/// @notice Mock of the LendingMarketV2 async-settle slice for NFT auction adapter tests.
/// @dev Mirrors the real settleLiquidation isolation checks: handoff → adapter.liquidate
///      must return (0,0) and move no lending asset.
contract MockNFTLiquidationMarket {
    address public immutable collateralAsset;
    address public immutable lendingAsset;
    address public immutable positionAdapter; // self — exposes ownerOf
    address public assetAdapter;

    struct Loan {
        uint256 collateralAmount;
        uint256 principal;
        uint256 startTime;
        uint256 expiryTime;
        uint256 frozenInterestAt;
        uint8 status;
    }

    mapping(uint256 => Loan) public loans;
    mapping(uint256 => address) public loanHolder;
    uint256 public nextLoanId;

    constructor(address collateralToken, address lendingToken) {
        collateralAsset = collateralToken;
        lendingAsset = lendingToken;
        positionAdapter = address(this);
        nextLoanId = 1;
    }

    function setAssetAdapter(address assetAdapter_) external {
        assetAdapter = assetAdapter_;
    }

    /// @notice Register a loan whose collateral (tokenId) lives in this mock (like the real escrow)
    function addLoan(uint256 tokenId, address holder) external {
        uint256 loanId = nextLoanId++;
        loans[loanId] = Loan({ collateralAmount: tokenId, principal: 0, startTime: 0, expiryTime: 0, frozenInterestAt: 0, status: 4 });
        loanHolder[loanId] = holder;
    }

    /// @notice Position-adapter stand-in: the holder of the position NFT
    function ownerOf(uint256 loanId) external view returns (address) {
        return loanHolder[loanId];
    }

    /// @notice Simulate market.settleLiquidation: hand off collateral, then call adapter.liquidate
    ///         and verify async isolation ((0,0) return, no lending-asset delta).
    function invokeSettle(address adapter, uint256 loanId, uint256 debtOwed) external {
        Loan storage loan = loans[loanId];
        // Handoff: collateral NFT moves from this mock (escrow) to the adapter
        uint256 tokenId = loan.collateralAmount;
        IERC721(collateralAsset).transferFrom(address(this), adapter, tokenId);

        uint256 balanceBefore = IERC20(lendingAsset).balanceOf(address(this));
        (uint256 recovered, uint256 returned) = ILiquidationAdapterCaller(adapter).liquidate(loanId, debtOwed);
        uint256 balanceAfter = IERC20(lendingAsset).balanceOf(address(this));

        require(balanceAfter == balanceBefore, "AdapterAccountingMismatch");
        require(recovered == 0 && returned == 0, "AdapterAccountingMismatch");
    }

    /// @notice Simulate finalizeRedemptionSettlement accounting: whole delta is recovery
    function finalizeDelta() external view returns (uint256) {
        return IERC20(lendingAsset).balanceOf(address(this));
    }

    function fund(address token, address to, uint256 amount) external {
        require(IERC20(token).transfer(to, amount), "fund failed");
    }
}
