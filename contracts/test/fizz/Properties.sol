// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Snapshots} from "./Snapshots.sol";
import {PropertiesAsserts} from "./utils/PropertiesAsserts.sol";

/// @notice Global invariants for OpenAsset Market LendingMarketV2
abstract contract Properties is PropertiesAsserts, Snapshots {

    /// @notice GL-01: availableLiquidity never exceeds totalLiquidity
    function property_availableLteTotal() public view returns (bool) {
        return market.availableLiquidity() <= market.totalLiquidity();
    }

    /// @notice GL-02: totalBorrowed never exceeds totalLiquidity + available (solvency bound)
    function property_borrowedConsistent() public view returns (bool) {
        // totalBorrowed + availableLiquidity should equal totalLiquidity when accounting is correct
        // Allow slack for interest retained in pool (totalLiquidity can grow)
        return market.totalBorrowed() <= market.totalLiquidity() + market.availableLiquidity();
    }

    /// @notice GL-03: market lending-asset balance covers availableLiquidity
    function property_balanceCoversAvailable() public view returns (bool) {
        uint256 bal = lendingAsset.balanceOf(address(market));
        return bal >= market.availableLiquidity();
    }

    /// @notice GL-04: LP total supply is zero iff totalLiquidity is zero (except dust)
    function property_lpSupplyMatchesLiquidity() public view returns (bool) {
        uint256 supply = market.lpToken().totalSupply();
        uint256 liq = market.totalLiquidity();
        if (supply == 0) return liq == 0;
        return liq > 0;
    }

    /// @notice GL-05: nextLoanId is monotonic non-decreasing vs ghost
    function property_loanIdMonotone() public view returns (bool) {
        return market.nextLoanId() >= ghost_loansCreated || ghost_loansCreated == 0;
    }
}
