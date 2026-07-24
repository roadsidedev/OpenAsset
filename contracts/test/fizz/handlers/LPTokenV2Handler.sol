// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with LPTokenV2
abstract contract LPTokenV2Handler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function lPTokenV2_approve_clamped(address spender, uint256 amount) public {
        // TODO: clamp spender — e.g. spender = toActor(spender);
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lPTokenV2_approve(spender, amount);
    }

    function lPTokenV2_burn_clamped(address from, uint256 amount) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lPTokenV2_burn(from, amount);
    }

    function lPTokenV2_decreaseAllowance_clamped(address spender, uint256 subtractedValue) public {
        // TODO: clamp spender — e.g. spender = toActor(spender);
        // TODO: clamp subtractedValue — e.g. subtractedValue = clampBetween(subtractedValue, min, max);
        lPTokenV2_decreaseAllowance(spender, subtractedValue);
    }

    function lPTokenV2_increaseAllowance_clamped(address spender, uint256 addedValue) public {
        // TODO: clamp spender — e.g. spender = toActor(spender);
        // TODO: clamp addedValue — e.g. addedValue = clampBetween(addedValue, min, max);
        lPTokenV2_increaseAllowance(spender, addedValue);
    }

    function lPTokenV2_mint_clamped(address to, uint256 amount) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lPTokenV2_mint(to, amount);
    }

    function lPTokenV2_transfer_clamped(address to, uint256 amount) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lPTokenV2_transfer(to, amount);
    }

    function lPTokenV2_transferFrom_clamped(address from, address to, uint256 amount) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lPTokenV2_transferFrom(from, to, amount);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function lPTokenV2_approve(address spender, uint256 amount) public asActor {
        // TODO: wire call — lPTokenV2.approve(spender, amount);
    }

    function lPTokenV2_burn(address from, uint256 amount) public asActor {
        // TODO: wire call — lPTokenV2.burn(from, amount);
    }

    function lPTokenV2_decreaseAllowance(address spender, uint256 subtractedValue) public asActor {
        // TODO: wire call — lPTokenV2.decreaseAllowance(spender, subtractedValue);
    }

    function lPTokenV2_increaseAllowance(address spender, uint256 addedValue) public asActor {
        // TODO: wire call — lPTokenV2.increaseAllowance(spender, addedValue);
    }

    function lPTokenV2_mint(address to, uint256 amount) public asActor {
        // TODO: wire call — lPTokenV2.mint(to, amount);
    }

    function lPTokenV2_transfer(address to, uint256 amount) public asActor {
        // TODO: wire call — lPTokenV2.transfer(to, amount);
    }

    function lPTokenV2_transferFrom(address from, address to, uint256 amount) public asActor {
        // TODO: wire call — lPTokenV2.transferFrom(from, to, amount);
    }
}
