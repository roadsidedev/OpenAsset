// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Base} from "./Base.sol";

/// @notice Before/after state tracking for specific properties
abstract contract Snapshots is Base {
    struct MarketSnapshot {
        uint256 totalLiquidity;
        uint256 availableLiquidity;
        uint256 totalBorrowed;
        uint256 nextLoanId;
    }

    MarketSnapshot internal pre;
    MarketSnapshot internal post;

    function _snapshotPre() internal {
        pre = MarketSnapshot({
            totalLiquidity: market.totalLiquidity(),
            availableLiquidity: market.availableLiquidity(),
            totalBorrowed: market.totalBorrowed(),
            nextLoanId: market.nextLoanId()
        });
    }

    function _snapshotPost() internal {
        post = MarketSnapshot({
            totalLiquidity: market.totalLiquidity(),
            availableLiquidity: market.availableLiquidity(),
            totalBorrowed: market.totalBorrowed(),
            nextLoanId: market.nextLoanId()
        });
    }
}
