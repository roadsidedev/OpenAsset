// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with UniswapV3TWAPAdapter
abstract contract UniswapV3TWAPAdapterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function uniswapV3TWAPAdapter_registerMarket_clamped(address market, address asset, address pool, bool token0IsBase) public {
        // TODO: clamp market — e.g. market = toActor(market);
        // TODO: clamp asset — e.g. asset = toActor(asset);
        // TODO: clamp pool — e.g. pool = toActor(pool);
        uniswapV3TWAPAdapter_registerMarket(market, asset, pool, token0IsBase);
    }

    function uniswapV3TWAPAdapter_updatePrice_clamped(address asset, uint256 newPrice) public {
        // TODO: clamp asset — e.g. asset = toActor(asset);
        // TODO: clamp newPrice — e.g. newPrice = clampBetween(newPrice, min, max);
        uniswapV3TWAPAdapter_updatePrice(asset, newPrice);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function uniswapV3TWAPAdapter_registerMarket(address market, address asset, address pool, bool token0IsBase) public asActor {
        // TODO: wire call — uniswapV3TWAPAdapter.registerMarket(market, asset, pool, token0IsBase);
    }

    function uniswapV3TWAPAdapter_updatePrice(address asset, uint256 newPrice) public asActor {
        // TODO: wire call — uniswapV3TWAPAdapter.updatePrice(asset, newPrice);
    }
}
