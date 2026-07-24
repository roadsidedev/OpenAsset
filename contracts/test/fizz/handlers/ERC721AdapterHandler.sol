// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with ERC721Adapter
abstract contract ERC721AdapterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function eRC721Adapter_escrow_clamped(address from, uint256 amountOrId) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp amountOrId — e.g. amountOrId = clampBetween(amountOrId, min, max);
        eRC721Adapter_escrow(from, amountOrId);
    }

    function eRC721Adapter_onERC721Received_clamped(address _arg0, address _arg1, uint256 _arg2, bytes memory _arg3) public {
        // TODO: clamp _arg0 — e.g. _arg0 = toActor(_arg0);
        // TODO: clamp _arg1 — e.g. _arg1 = toActor(_arg1);
        // TODO: clamp _arg2 — e.g. _arg2 = clampBetween(_arg2, min, max);
        eRC721Adapter_onERC721Received(_arg0, _arg1, _arg2, _arg3);
    }

    function eRC721Adapter_release_clamped(address to, uint256 amountOrId) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp amountOrId — e.g. amountOrId = clampBetween(amountOrId, min, max);
        eRC721Adapter_release(to, amountOrId);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function eRC721Adapter_escrow(address from, uint256 amountOrId) public asActor {
        // TODO: wire call — eRC721Adapter.escrow(from, amountOrId);
    }

    function eRC721Adapter_onERC721Received(address _arg0, address _arg1, uint256 _arg2, bytes memory _arg3) public asActor {
        // TODO: wire call — eRC721Adapter.onERC721Received(_arg0, _arg1, _arg2, _arg3);
    }

    function eRC721Adapter_release(address to, uint256 amountOrId) public asActor {
        // TODO: wire call — eRC721Adapter.release(to, amountOrId);
    }
}
