// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with ERC20Adapter
abstract contract ERC20AdapterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function eRC20Adapter_escrow_clamped(address from, uint256 amountOrId) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp amountOrId — e.g. amountOrId = clampBetween(amountOrId, min, max);
        eRC20Adapter_escrow(from, amountOrId);
    }

    function eRC20Adapter_release_clamped(address to, uint256 amountOrId) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp amountOrId — e.g. amountOrId = clampBetween(amountOrId, min, max);
        eRC20Adapter_release(to, amountOrId);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function eRC20Adapter_escrow(address from, uint256 amountOrId) public asActor {
        // TODO: wire call — eRC20Adapter.escrow(from, amountOrId);
    }

    function eRC20Adapter_release(address to, uint256 amountOrId) public asActor {
        // TODO: wire call — eRC20Adapter.release(to, amountOrId);
    }
}
