// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with StandardPositionAdapter
abstract contract StandardPositionAdapterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function standardPositionAdapter_burn_clamped(uint256 loanId) public {
        // TODO: clamp loanId — e.g. loanId = clampBetween(loanId, min, max);
        standardPositionAdapter_burn(loanId);
    }

    function standardPositionAdapter_mint_clamped(address to, uint256 loanId) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp loanId — e.g. loanId = clampBetween(loanId, min, max);
        standardPositionAdapter_mint(to, loanId);
    }

    function standardPositionAdapter_registerMarket_clamped(address market) public {
        // TODO: clamp market — e.g. market = toActor(market);
        standardPositionAdapter_registerMarket(market);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function standardPositionAdapter_burn(uint256 loanId) public asActor {
        // TODO: wire call — standardPositionAdapter.burn(loanId);
    }

    function standardPositionAdapter_mint(address to, uint256 loanId) public asActor {
        // TODO: wire call — standardPositionAdapter.mint(to, loanId);
    }

    function standardPositionAdapter_registerMarket(address market) public asActor {
        // TODO: wire call — standardPositionAdapter.registerMarket(market);
    }
}
