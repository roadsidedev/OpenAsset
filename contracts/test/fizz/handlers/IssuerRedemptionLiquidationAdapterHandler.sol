// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with IssuerRedemptionLiquidationAdapter
abstract contract IssuerRedemptionLiquidationAdapterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function issuerRedemptionLiquidationAdapter_liquidate_clamped(uint256 loanId, uint256 debtOwed) public {
        // TODO: clamp loanId — e.g. loanId = clampBetween(loanId, min, max);
        // TODO: clamp debtOwed — e.g. debtOwed = clampBetween(debtOwed, min, max);
        issuerRedemptionLiquidationAdapter_liquidate(loanId, debtOwed);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function issuerRedemptionLiquidationAdapter_liquidate(uint256 loanId, uint256 debtOwed) public asActor {
        // TODO: wire call — issuerRedemptionLiquidationAdapter.liquidate(loanId, debtOwed);
    }
}
