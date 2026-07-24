// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Properties} from "../Properties.sol";

/// @notice Handlers for LendingMarketV2 core flows
abstract contract LendingMarketV2Handler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function lendingMarketV2_depositLiquidity_clamped(uint256 amount) public {
        uint256 bal = lendingAsset.balanceOf(actor);
        if (bal == 0) return;
        amount = clampBetween(amount, 1, bal);
        lendingMarketV2_depositLiquidity(amount);
    }

    function lendingMarketV2_withdrawLiquidity_clamped(uint256 shares) public {
        uint256 owned = market.lpToken().balanceOf(actor);
        if (owned == 0) return;
        shares = clampBetween(shares, 1, owned);
        lendingMarketV2_withdrawLiquidity(shares);
    }

    function lendingMarketV2_requestLoan_clamped(uint256 collateralAmount) public {
        uint256 bal = collateralAsset.balanceOf(actor);
        if (bal == 0) return;
        // Keep collateral in a usable range for LTV math
        collateralAmount = clampBetween(collateralAmount, 1e15, bal);
        lendingMarketV2_requestLoan(collateralAmount);
    }

    function lendingMarketV2_repay_clamped(uint256 loanId) public {
        uint256 nextId = market.nextLoanId();
        if (nextId == 0) return;
        loanId = clampBetween(loanId, 0, nextId - 1);
        lendingMarketV2_repay(loanId);
    }

    function lendingMarketV2_liquidate_clamped(uint256 loanId) public {
        uint256 nextId = market.nextLoanId();
        if (nextId == 0) return;
        loanId = clampBetween(loanId, 0, nextId - 1);
        lendingMarketV2_liquidate(loanId);
    }

    function lendingMarketV2_skipTime_clamped(uint256 time) public {
        time = clampBetween(time, 1 hours, 30 days);
        skipTime(time);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function lendingMarketV2_depositLiquidity(uint256 amount) public asActor {
        try market.depositLiquidity(amount) {
            ghost_totalDeposited += amount;
        } catch {}
    }

    function lendingMarketV2_withdrawLiquidity(uint256 shares) public asActor {
        try market.withdrawLiquidity(shares) returns (uint256 amount) {
            // amount left the pool
            if (ghost_totalDeposited >= amount) ghost_totalDeposited -= amount;
        } catch {}
    }

    function lendingMarketV2_requestLoan(uint256 collateralAmount) public asActor {
        try market.requestLoan(collateralAmount) returns (uint256) {
            ghost_loansCreated += 1;
        } catch {}
    }

    function lendingMarketV2_repay(uint256 loanId) public asActor {
        try market.repay(loanId) {
            ghost_totalRepaid += 1;
        } catch {}
    }

    function lendingMarketV2_liquidate(uint256 loanId) public asActor {
        try market.liquidate(loanId) {} catch {}
    }

    function lendingMarketV2_pause() public asAdmin {
        try market.pause() {} catch {}
    }

    function lendingMarketV2_unpause() public asAdmin {
        try market.unpause() {} catch {}
    }
}
