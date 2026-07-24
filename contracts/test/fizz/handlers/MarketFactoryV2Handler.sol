// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with MarketFactoryV2
abstract contract MarketFactoryV2Handler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function marketFactoryV2_addLendingAsset_clamped(address asset) public {
        // TODO: clamp asset — e.g. asset = toActor(asset);
        marketFactoryV2_addLendingAsset(asset);
    }

    function marketFactoryV2_createMarket_clamped(MarketFactoryV2.MarketConfig memory config, uint256 initialLiquidity) public {
        // TODO: clamp initialLiquidity — e.g. initialLiquidity = clampBetween(initialLiquidity, min, max);
        marketFactoryV2_createMarket(config, initialLiquidity);
    }

    function marketFactoryV2_removeLendingAsset_clamped(address asset) public {
        // TODO: clamp asset — e.g. asset = toActor(asset);
        marketFactoryV2_removeLendingAsset(asset);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function marketFactoryV2_addLendingAsset(address asset) public asActor {
        // TODO: wire call — marketFactoryV2.addLendingAsset(asset);
    }

    function marketFactoryV2_createMarket(MarketFactoryV2.MarketConfig memory config, uint256 initialLiquidity) public asActor {
        // TODO: wire call — marketFactoryV2.createMarket(config, initialLiquidity);
    }

    function marketFactoryV2_removeLendingAsset(address asset) public asActor {
        // TODO: wire call — marketFactoryV2.removeLendingAsset(asset);
    }
}
