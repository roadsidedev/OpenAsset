// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with LoanContract
abstract contract LoanContractHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function loanContract_initialize_clamped(address borrower_, uint256 collateralAmount_, uint256 tokenId_, uint256 erc1155Amount_, uint256 principal_, uint256 interestAmount_, uint256 expiryTime_) public {
        // TODO: clamp borrower_ — e.g. borrower_ = toActor(borrower_);
        // TODO: clamp collateralAmount_ — e.g. collateralAmount_ = clampBetween(collateralAmount_, min, max);
        // TODO: clamp tokenId_ — e.g. tokenId_ = clampBetween(tokenId_, min, max);
        // TODO: clamp erc1155Amount_ — e.g. erc1155Amount_ = clampBetween(erc1155Amount_, min, max);
        // TODO: clamp principal_ — e.g. principal_ = clampBetween(principal_, min, max);
        // TODO: clamp interestAmount_ — e.g. interestAmount_ = clampBetween(interestAmount_, min, max);
        // TODO: clamp expiryTime_ — e.g. expiryTime_ = clampBetween(expiryTime_, min, max);
        loanContract_initialize(borrower_, collateralAmount_, tokenId_, erc1155Amount_, principal_, interestAmount_, expiryTime_);
    }

    function loanContract_liquidate_clamped() public {
        loanContract_liquidate();
    }

    function loanContract_repay_clamped() public {
        loanContract_repay();
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function loanContract_initialize(address borrower_, uint256 collateralAmount_, uint256 tokenId_, uint256 erc1155Amount_, uint256 principal_, uint256 interestAmount_, uint256 expiryTime_) public asActor {
        // TODO: wire call — loanContract.initialize(borrower_, collateralAmount_, tokenId_, erc1155Amount_, principal_, interestAmount_, expiryTime_);
    }

    function loanContract_liquidate() public asActor {
        // TODO: wire call — loanContract.liquidate();
    }

    function loanContract_repay() public asActor {
        // TODO: wire call — loanContract.repay();
    }
}
