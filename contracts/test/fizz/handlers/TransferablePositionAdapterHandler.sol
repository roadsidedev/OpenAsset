// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with TransferablePositionAdapter
abstract contract TransferablePositionAdapterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function transferablePositionAdapter_approve_clamped(address to, uint256 tokenId) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp tokenId — e.g. tokenId = clampBetween(tokenId, min, max);
        transferablePositionAdapter_approve(to, tokenId);
    }

    function transferablePositionAdapter_burn_clamped(uint256 loanId) public {
        // TODO: clamp loanId — e.g. loanId = clampBetween(loanId, min, max);
        transferablePositionAdapter_burn(loanId);
    }

    function transferablePositionAdapter_mint_clamped(address to, uint256 loanId) public {
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp loanId — e.g. loanId = clampBetween(loanId, min, max);
        transferablePositionAdapter_mint(to, loanId);
    }

    function transferablePositionAdapter_registerMarket_clamped(address market) public {
        // TODO: clamp market — e.g. market = toActor(market);
        transferablePositionAdapter_registerMarket(market);
    }

    function transferablePositionAdapter_safeTransferFrom_clamped(address from, address to, uint256 tokenId) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp tokenId — e.g. tokenId = clampBetween(tokenId, min, max);
        transferablePositionAdapter_safeTransferFrom(from, to, tokenId);
    }

    function transferablePositionAdapter_safeTransferFrom_clamped(address from, address to, uint256 tokenId, bytes memory data) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp tokenId — e.g. tokenId = clampBetween(tokenId, min, max);
        transferablePositionAdapter_safeTransferFrom(from, to, tokenId, data);
    }

    function transferablePositionAdapter_setApprovalForAll_clamped(address operator, bool approved) public {
        // TODO: clamp operator — e.g. operator = toActor(operator);
        transferablePositionAdapter_setApprovalForAll(operator, approved);
    }

    function transferablePositionAdapter_transferFrom_clamped(address from, address to, uint256 tokenId) public {
        // TODO: clamp from — e.g. from = toActor(from);
        // TODO: clamp to — e.g. to = toActor(to);
        // TODO: clamp tokenId — e.g. tokenId = clampBetween(tokenId, min, max);
        transferablePositionAdapter_transferFrom(from, to, tokenId);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function transferablePositionAdapter_approve(address to, uint256 tokenId) public asActor {
        // TODO: wire call — transferablePositionAdapter.approve(to, tokenId);
    }

    function transferablePositionAdapter_burn(uint256 loanId) public asActor {
        // TODO: wire call — transferablePositionAdapter.burn(loanId);
    }

    function transferablePositionAdapter_mint(address to, uint256 loanId) public asActor {
        // TODO: wire call — transferablePositionAdapter.mint(to, loanId);
    }

    function transferablePositionAdapter_registerMarket(address market) public asActor {
        // TODO: wire call — transferablePositionAdapter.registerMarket(market);
    }

    function transferablePositionAdapter_safeTransferFrom(address from, address to, uint256 tokenId) public asActor {
        // TODO: wire call — transferablePositionAdapter.safeTransferFrom(from, to, tokenId);
    }

    function transferablePositionAdapter_safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public asActor {
        // TODO: wire call — transferablePositionAdapter.safeTransferFrom(from, to, tokenId, data);
    }

    function transferablePositionAdapter_setApprovalForAll(address operator, bool approved) public asActor {
        // TODO: wire call — transferablePositionAdapter.setApprovalForAll(operator, approved);
    }

    function transferablePositionAdapter_transferFrom(address from, address to, uint256 tokenId) public asActor {
        // TODO: wire call — transferablePositionAdapter.transferFrom(from, to, tokenId);
    }
}
