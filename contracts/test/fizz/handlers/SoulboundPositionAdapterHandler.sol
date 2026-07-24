// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with SoulboundPositionAdapter
abstract contract SoulboundPositionAdapterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function soulboundPositionAdapter_approve_clamped(address to, uint256 tokenId) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp tokenId — e.g. tokenId = clampBetween(tokenId, min, max);
        soulboundPositionAdapter_approve(to, tokenId);
    }

    function soulboundPositionAdapter_burn_clamped(uint256 loanId) public {
        // TODO: clamp loanId — e.g. loanId = clampBetween(loanId, min, max);
        soulboundPositionAdapter_burn(loanId);
    }

    function soulboundPositionAdapter_mint_clamped(address to, uint256 loanId) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp loanId — e.g. loanId = clampBetween(loanId, min, max);
        soulboundPositionAdapter_mint(to, loanId);
    }

    function soulboundPositionAdapter_registerMarket_clamped(address market) public {
        // TODO: clamp market — e.g. market = toActor(market);
        soulboundPositionAdapter_registerMarket(market);
    }

    function soulboundPositionAdapter_safeTransferFrom_clamped(address from, address to, uint256 tokenId) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp tokenId — e.g. tokenId = clampBetween(tokenId, min, max);
        soulboundPositionAdapter_safeTransferFrom(from, to, tokenId);
    }

    function soulboundPositionAdapter_safeTransferFrom_clamped(address from, address to, uint256 tokenId, bytes memory data) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp tokenId — e.g. tokenId = clampBetween(tokenId, min, max);
        soulboundPositionAdapter_safeTransferFrom(from, to, tokenId, data);
    }

    function soulboundPositionAdapter_setApprovalForAll_clamped(address operator, bool approved) public {
        // TODO: clamp operator — e.g. operator = toActor(operator);
        soulboundPositionAdapter_setApprovalForAll(operator, approved);
    }

    function soulboundPositionAdapter_transferFrom_clamped(address from, address to, uint256 tokenId) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp tokenId — e.g. tokenId = clampBetween(tokenId, min, max);
        soulboundPositionAdapter_transferFrom(from, to, tokenId);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function soulboundPositionAdapter_approve(address to, uint256 tokenId) public asActor {
        // TODO: wire call — soulboundPositionAdapter.approve(to, tokenId);
    }

    function soulboundPositionAdapter_burn(uint256 loanId) public asActor {
        // TODO: wire call — soulboundPositionAdapter.burn(loanId);
    }

    function soulboundPositionAdapter_mint(address to, uint256 loanId) public asActor {
        // TODO: wire call — soulboundPositionAdapter.mint(to, loanId);
    }

    function soulboundPositionAdapter_registerMarket(address market) public asActor {
        // TODO: wire call — soulboundPositionAdapter.registerMarket(market);
    }

    function soulboundPositionAdapter_safeTransferFrom(address from, address to, uint256 tokenId) public asActor {
        // TODO: wire call — soulboundPositionAdapter.safeTransferFrom(from, to, tokenId);
    }

    function soulboundPositionAdapter_safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public asActor {
        // TODO: wire call — soulboundPositionAdapter.safeTransferFrom(from, to, tokenId, data);
    }

    function soulboundPositionAdapter_setApprovalForAll(address operator, bool approved) public asActor {
        // TODO: wire call — soulboundPositionAdapter.setApprovalForAll(operator, approved);
    }

    function soulboundPositionAdapter_transferFrom(address from, address to, uint256 tokenId) public asActor {
        // TODO: wire call — soulboundPositionAdapter.transferFrom(from, to, tokenId);
    }
}
