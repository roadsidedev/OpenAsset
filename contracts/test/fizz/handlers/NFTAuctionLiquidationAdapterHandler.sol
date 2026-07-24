// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with NFTAuctionLiquidationAdapter
abstract contract NFTAuctionLiquidationAdapterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function nFTAuctionLiquidationAdapter_liquidate_clamped(uint256 loanId, uint256 debtOwed) public {
        // TODO: clamp loanId — e.g. loanId = clampBetween(loanId, min, max);
        // TODO: clamp debtOwed — e.g. debtOwed = clampBetween(debtOwed, min, max);
        nFTAuctionLiquidationAdapter_liquidate(loanId, debtOwed);
    }

    function nFTAuctionLiquidationAdapter_onERC721Received_clamped(address _arg0, address _arg1, uint256 _arg2, bytes memory _arg3) public {
        // TODO: clamp _arg0 — e.g. _arg0 = toActor(_arg0);
        // TODO: clamp _arg1 — e.g. _arg1 = toActor(_arg1);
        // TODO: clamp _arg2 — e.g. _arg2 = clampBetween(_arg2, min, max);
        nFTAuctionLiquidationAdapter_onERC721Received(_arg0, _arg1, _arg2, _arg3);
    }

    function nFTAuctionLiquidationAdapter_registerMarket_clamped(address market) public {
        // TODO: clamp market — e.g. market = toActor(market);
        nFTAuctionLiquidationAdapter_registerMarket(market);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function nFTAuctionLiquidationAdapter_liquidate(uint256 loanId, uint256 debtOwed) public asActor {
        // TODO: wire call — nFTAuctionLiquidationAdapter.liquidate(loanId, debtOwed);
    }

    function nFTAuctionLiquidationAdapter_onERC721Received(address _arg0, address _arg1, uint256 _arg2, bytes memory _arg3) public asActor {
        // TODO: wire call — nFTAuctionLiquidationAdapter.onERC721Received(_arg0, _arg1, _arg2, _arg3);
    }

    function nFTAuctionLiquidationAdapter_registerMarket(address market) public asActor {
        // TODO: wire call — nFTAuctionLiquidationAdapter.registerMarket(market);
    }
}
