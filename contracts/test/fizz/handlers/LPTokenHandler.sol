// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with LPToken
abstract contract LPTokenHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function lPToken_approve_clamped(address spender, uint256 amount) public {
        // TODO: clamp spender — e.g. spender = toActor(spender);
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lPToken_approve(spender, amount);
    }

    function lPToken_burn_clamped(address from, uint256 amount) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lPToken_burn(from, amount);
    }

    function lPToken_decreaseAllowance_clamped(address spender, uint256 subtractedValue) public {
        // TODO: clamp spender — e.g. spender = toActor(spender);
        // TODO: clamp subtractedValue — e.g. subtractedValue = clampBetween(subtractedValue, min, max);
        lPToken_decreaseAllowance(spender, subtractedValue);
    }

    function lPToken_increaseAllowance_clamped(address spender, uint256 addedValue) public {
        // TODO: clamp spender — e.g. spender = toActor(spender);
        // TODO: clamp addedValue — e.g. addedValue = clampBetween(addedValue, min, max);
        lPToken_increaseAllowance(spender, addedValue);
    }

    function lPToken_mint_clamped(address to, uint256 amount) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lPToken_mint(to, amount);
    }

    function lPToken_transfer_clamped(address to, uint256 amount) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lPToken_transfer(to, amount);
    }

    function lPToken_transferFrom_clamped(address from, address to, uint256 amount) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp amount — e.g. amount = clampBetween(amount, min, max);
        lPToken_transferFrom(from, to, amount);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function lPToken_approve(address spender, uint256 amount) public asActor {
        // TODO: wire call — lPToken.approve(spender, amount);
    }

    function lPToken_burn(address from, uint256 amount) public asActor {
        // TODO: wire call — lPToken.burn(from, amount);
    }

    function lPToken_decreaseAllowance(address spender, uint256 subtractedValue) public asActor {
        // TODO: wire call — lPToken.decreaseAllowance(spender, subtractedValue);
    }

    function lPToken_increaseAllowance(address spender, uint256 addedValue) public asActor {
        // TODO: wire call — lPToken.increaseAllowance(spender, addedValue);
    }

    function lPToken_mint(address to, uint256 amount) public asActor {
        // TODO: wire call — lPToken.mint(to, amount);
    }

    function lPToken_transfer(address to, uint256 amount) public asActor {
        // TODO: wire call — lPToken.transfer(to, amount);
    }

    function lPToken_transferFrom(address from, address to, uint256 amount) public asActor {
        // TODO: wire call — lPToken.transferFrom(from, to, amount);
    }
}
