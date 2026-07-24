// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with MarketFactory
abstract contract MarketFactoryHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function marketFactory_addStablecoin_clamped(address stablecoin, uint8 decimals) public {
        // TODO: clamp stablecoin — e.g. stablecoin = toActor(stablecoin);
        // TODO: clamp decimals — e.g. decimals = clampBetween(decimals, min, max);
        marketFactory_addStablecoin(stablecoin, decimals);
    }

    function marketFactory_createMarket_clamped(address collateralAsset, address loanAsset, uint8 assetType, uint8 oracleType, address primaryOracle, address nftOracle, uint256 ltvBps, uint256 aprBps, uint256 durationSeconds, uint256 initialLiquidity) public {
        // TODO: clamp collateralAsset — e.g. collateralAsset = toActor(collateralAsset);
        // TODO: clamp loanAsset — e.g. loanAsset = toActor(loanAsset);
        // TODO: clamp primaryOracle — e.g. primaryOracle = toActor(primaryOracle);
        // TODO: clamp nftOracle — e.g. nftOracle = toActor(nftOracle);
        // TODO: clamp ltvBps — e.g. ltvBps = clampBetween(ltvBps, min, max);
        // TODO: clamp aprBps — e.g. aprBps = clampBetween(aprBps, min, max);
        // TODO: clamp durationSeconds — e.g. durationSeconds = clampBetween(durationSeconds, min, max);
        // TODO: clamp initialLiquidity — e.g. initialLiquidity = clampBetween(initialLiquidity, min, max);
        marketFactory_createMarket(collateralAsset, loanAsset, assetType, oracleType, primaryOracle, nftOracle, ltvBps, aprBps, durationSeconds, initialLiquidity);
    }

    function marketFactory_deactivateMarket_clamped(address market) public {
        // TODO: clamp market — e.g. market = toActor(market);
        marketFactory_deactivateMarket(market);
    }

    function marketFactory_pause_clamped() public {
        marketFactory_pause();
    }

    function marketFactory_reactivateMarket_clamped(address market) public {
        // TODO: clamp market — e.g. market = toActor(market);
        marketFactory_reactivateMarket(market);
    }

    function marketFactory_removeStablecoin_clamped(address stablecoin) public {
        // TODO: clamp stablecoin — e.g. stablecoin = toActor(stablecoin);
        marketFactory_removeStablecoin(stablecoin);
    }

    function marketFactory_renounceOwnership_clamped() public {
        marketFactory_renounceOwnership();
    }

    function marketFactory_transferOwnership_clamped(address newOwner) public {
        // TODO: clamp newOwner — e.g. newOwner = toActor(newOwner);
        marketFactory_transferOwnership(newOwner);
    }

    function marketFactory_unpause_clamped() public {
        marketFactory_unpause();
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function marketFactory_addStablecoin(address stablecoin, uint8 decimals) public asActor {
        // TODO: wire call — marketFactory.addStablecoin(stablecoin, decimals);
    }

    function marketFactory_createMarket(address collateralAsset, address loanAsset, uint8 assetType, uint8 oracleType, address primaryOracle, address nftOracle, uint256 ltvBps, uint256 aprBps, uint256 durationSeconds, uint256 initialLiquidity) public asActor {
        // TODO: wire call — marketFactory.createMarket(collateralAsset, loanAsset, assetType, oracleType, primaryOracle, nftOracle, ltvBps, aprBps, durationSeconds, initialLiquidity);
    }

    function marketFactory_deactivateMarket(address market) public asActor {
        // TODO: wire call — marketFactory.deactivateMarket(market);
    }

    function marketFactory_pause() public asActor {
        // TODO: wire call — marketFactory.pause();
    }

    function marketFactory_reactivateMarket(address market) public asActor {
        // TODO: wire call — marketFactory.reactivateMarket(market);
    }

    function marketFactory_removeStablecoin(address stablecoin) public asActor {
        // TODO: wire call — marketFactory.removeStablecoin(stablecoin);
    }

    function marketFactory_renounceOwnership() public asActor {
        // TODO: wire call — marketFactory.renounceOwnership();
    }

    function marketFactory_transferOwnership(address newOwner) public asActor {
        // TODO: wire call — marketFactory.transferOwnership(newOwner);
    }

    function marketFactory_unpause() public asActor {
        // TODO: wire call — marketFactory.unpause();
    }
}
