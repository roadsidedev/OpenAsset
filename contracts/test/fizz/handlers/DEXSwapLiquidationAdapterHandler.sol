// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with DEXSwapLiquidationAdapter
abstract contract DEXSwapLiquidationAdapterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function dEXSwapLiquidationAdapter_liquidate_clamped(uint256 loanId, uint256 debtOwed) public {
        // TODO: clamp loanId — e.g. loanId = clampBetween(loanId, min, max);
        // TODO: clamp debtOwed — e.g. debtOwed = clampBetween(debtOwed, min, max);
        dEXSwapLiquidationAdapter_liquidate(loanId, debtOwed);
    }

    function dEXSwapLiquidationAdapter_registerMarket_clamped(address market) public {
        // TODO: clamp market — e.g. market = toActor(market);
        dEXSwapLiquidationAdapter_registerMarket(market);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function dEXSwapLiquidationAdapter_liquidate(uint256 loanId, uint256 debtOwed) public asActor {
        // TODO: wire call — dEXSwapLiquidationAdapter.liquidate(loanId, debtOwed);
    }

    function dEXSwapLiquidationAdapter_registerMarket(address market) public asActor {
        // TODO: wire call — dEXSwapLiquidationAdapter.registerMarket(market);
    }
}
