// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Handlers} from "./handlers/Handlers.sol";

/// @notice Foundry entry point for smoke tests and repros
contract FoundryTester is Test, Handlers {
    modifier asActor() override {
        vm.startPrank(actor);
        _;
        vm.stopPrank();
    }

    function setUp() public {
        setup();
    }

    function test_smoke_deposit_borrow_repay() public {
        setCurrentActor(0);

        // Alice deposits liquidity
        lendingMarketV2_depositLiquidity_clamped(10_000e6);
        assertTrue(property_availableLteTotal(), "GL-01 after deposit");
        assertTrue(property_balanceCoversAvailable(), "GL-03 after deposit");

        // Bob borrows
        setCurrentActor(1);
        lendingMarketV2_requestLoan_clamped(1e18);
        assertTrue(property_availableLteTotal(), "GL-01 after borrow");

        // Anyone can repay if funded
        setCurrentActor(0);
        if (market.nextLoanId() > 0) {
            lendingMarketV2_repay_clamped(0);
        }

        assertTrue(property_availableLteTotal(), "GL-01 final");
        assertTrue(property_balanceCoversAvailable(), "GL-03 final");
        assertTrue(property_lpSupplyMatchesLiquidity(), "GL-04 final");
    }

    function test_properties_hold_initially() public view {
        assertTrue(property_availableLteTotal());
        assertTrue(property_borrowedConsistent());
        assertTrue(property_balanceCoversAvailable());
        assertTrue(property_lpSupplyMatchesLiquidity());
    }

    /// @notice Repro: tiny loan + repay must keep bal >= availableLiquidity
    /// Medusa found this when protocol fee was incorrectly taken from principal+interest.
    function test_repro_property_balanceCoversAvailable() public {
        setCurrentActor(0);
        // Tiny collateral loan (matches Medusa shrunk sequence shape)
        lendingMarketV2_requestLoan(7839);
        if (market.nextLoanId() > 0) {
            lendingMarketV2_repay(0);
        }
        assertTrue(property_balanceCoversAvailable(), "GL-03: bal must cover available after repay");
        assertTrue(property_availableLteTotal(), "GL-01 after repay");
    }
}

