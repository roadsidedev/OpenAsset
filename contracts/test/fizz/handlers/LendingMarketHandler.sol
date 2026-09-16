// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with LendingMarket
abstract contract LendingMarketHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function lendingMarket_depositLiquidity_clamped(uint256 amount) public {
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lendingMarket_depositLiquidity(amount);
    }

    function lendingMarket_initializeWithLiquidity_clamped(uint256 initialLiquidity) public {
        // TODO: clamp initialLiquidity — e.g. initialLiquidity = clampBetween(initialLiquidity, min, max);
        lendingMarket_initializeWithLiquidity(initialLiquidity);
    }

    function lendingMarket_pause_clamped() public {
        lendingMarket_pause();
    }

    function lendingMarket_removeLoan_clamped(address loanContract, uint256 principal) public {
        // TODO: clamp loanContract — e.g. loanContract = toActor(loanContract);
        // TODO: clamp principal — e.g. principal = clampBetween(principal, min, max);
        lendingMarket_removeLoan(loanContract, principal);
    }

    function lendingMarket_requestLoan_clamped(uint256 collateralAmount, uint256 tokenId) public {
        // TODO: clamp collateralAmount — e.g. collateralAmount = clampBetween(collateralAmount, min, max);
        // TODO: clamp tokenId — e.g. tokenId = clampBetween(tokenId, min, max);
        lendingMarket_requestLoan(collateralAmount, tokenId);
    }

    function lendingMarket_resetCircuitBreaker_clamped() public {
        lendingMarket_resetCircuitBreaker();
    }

    function lendingMarket_triggerCircuitBreaker_clamped() public {
        lendingMarket_triggerCircuitBreaker();
    }

    function lendingMarket_unpause_clamped() public {
        lendingMarket_unpause();
    }

    function lendingMarket_withdrawLiquidity_clamped(uint256 shares) public {
        // TODO: clamp shares — e.g. shares = clampBetween(shares, min, max);
        lendingMarket_withdrawLiquidity(shares);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function lendingMarket_depositLiquidity(uint256 amount) public asActor {
        // TODO: wire call — lendingMarket.depositLiquidity(amount);
    }

    function lendingMarket_initializeWithLiquidity(uint256 initialLiquidity) public asActor {
        // TODO: wire call — lendingMarket.initializeWithLiquidity(initialLiquidity);
    }

    function lendingMarket_pause() public asActor {
        // TODO: wire call — lendingMarket.pause();
    }

    function lendingMarket_removeLoan(address loanContract, uint256 principal) public asActor {
        // TODO: wire call — lendingMarket.removeLoan(loanContract, principal);
    }

    function lendingMarket_requestLoan(uint256 collateralAmount, uint256 tokenId) public asActor {
        // TODO: wire call — lendingMarket.requestLoan(collateralAmount, tokenId);
    }

    function lendingMarket_resetCircuitBreaker() public asActor {
        // TODO: wire call — lendingMarket.resetCircuitBreaker();
    }

    function lendingMarket_triggerCircuitBreaker() public asActor {
        // TODO: wire call — lendingMarket.triggerCircuitBreaker();
    }

    function lendingMarket_unpause() public asActor {
        // TODO: wire call — lendingMarket.unpause();
    }

    function lendingMarket_withdrawLiquidity(uint256 shares) public asActor {
        // TODO: wire call — lendingMarket.withdrawLiquidity(shares);
    }
}
