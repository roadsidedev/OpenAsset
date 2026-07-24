// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with NFTOracle
abstract contract NFTOracleHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function nFTOracle_addCollection_clamped(address collection) public {
        // TODO: clamp collection — e.g. collection = toActor(collection);
        nFTOracle_addCollection(collection);
    }

    function nFTOracle_approvePrice_clamped(address collection) public {
        // TODO: clamp collection — e.g. collection = toActor(collection);
        nFTOracle_approvePrice(collection);
    }

    function nFTOracle_authorizeUpdater_clamped(address updater) public {
        // TODO: clamp updater — e.g. updater = toActor(updater);
        nFTOracle_authorizeUpdater(updater);
    }

    function nFTOracle_disableEmergencyFallback_clamped() public {
        nFTOracle_disableEmergencyFallback();
    }

    function nFTOracle_enableEmergencyFallback_clamped() public {
        nFTOracle_enableEmergencyFallback();
    }

    function nFTOracle_pause_clamped() public {
        nFTOracle_pause();
    }

    function nFTOracle_proposePrice_clamped(address collection, uint256 floorPrice, uint256 volume24h, uint256 sales24h) public {
        // TODO: clamp collection — e.g. collection = toActor(collection);
        // TODO: clamp floorPrice — e.g. floorPrice = clampBetween(floorPrice, min, max);
        // TODO: clamp volume24h — e.g. volume24h = clampBetween(volume24h, min, max);
        // TODO: clamp sales24h — e.g. sales24h = clampBetween(sales24h, min, max);
        nFTOracle_proposePrice(collection, floorPrice, volume24h, sales24h);
    }

    function nFTOracle_removeCollection_clamped(address collection) public {
        // TODO: clamp collection — e.g. collection = toActor(collection);
        nFTOracle_removeCollection(collection);
    }

    function nFTOracle_renounceOwnership_clamped() public {
        nFTOracle_renounceOwnership();
    }

    function nFTOracle_revokeUpdater_clamped(address updater) public {
        // TODO: clamp updater — e.g. updater = toActor(updater);
        nFTOracle_revokeUpdater(updater);
    }

    function nFTOracle_transferOwnership_clamped(address newOwner) public {
        // TODO: clamp newOwner — e.g. newOwner = toActor(newOwner);
        nFTOracle_transferOwnership(newOwner);
    }

    function nFTOracle_unpause_clamped() public {
        nFTOracle_unpause();
    }

    function nFTOracle_updateETHUSDPriceFeed_clamped(address newPriceFeed) public {
        // TODO: clamp newPriceFeed — e.g. newPriceFeed = toActor(newPriceFeed);
        nFTOracle_updateETHUSDPriceFeed(newPriceFeed);
    }

    function nFTOracle_updateEmergencyCache_clamped(address collection) public {
        // TODO: clamp collection — e.g. collection = toActor(collection);
        nFTOracle_updateEmergencyCache(collection);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function nFTOracle_addCollection(address collection) public asActor {
        // TODO: wire call — nFTOracle.addCollection(collection);
    }

    function nFTOracle_approvePrice(address collection) public asActor {
        // TODO: wire call — nFTOracle.approvePrice(collection);
    }

    function nFTOracle_authorizeUpdater(address updater) public asActor {
        // TODO: wire call — nFTOracle.authorizeUpdater(updater);
    }

    function nFTOracle_disableEmergencyFallback() public asActor {
        // TODO: wire call — nFTOracle.disableEmergencyFallback();
    }

    function nFTOracle_enableEmergencyFallback() public asActor {
        // TODO: wire call — nFTOracle.enableEmergencyFallback();
    }

    function nFTOracle_pause() public asActor {
        // TODO: wire call — nFTOracle.pause();
    }

    function nFTOracle_proposePrice(address collection, uint256 floorPrice, uint256 volume24h, uint256 sales24h) public asActor {
        // TODO: wire call — nFTOracle.proposePrice(collection, floorPrice, volume24h, sales24h);
    }

    function nFTOracle_removeCollection(address collection) public asActor {
        // TODO: wire call — nFTOracle.removeCollection(collection);
    }

    function nFTOracle_renounceOwnership() public asActor {
        // TODO: wire call — nFTOracle.renounceOwnership();
    }

    function nFTOracle_revokeUpdater(address updater) public asActor {
        // TODO: wire call — nFTOracle.revokeUpdater(updater);
    }

    function nFTOracle_transferOwnership(address newOwner) public asActor {
        // TODO: wire call — nFTOracle.transferOwnership(newOwner);
    }

    function nFTOracle_unpause() public asActor {
        // TODO: wire call — nFTOracle.unpause();
    }

    function nFTOracle_updateETHUSDPriceFeed(address newPriceFeed) public asActor {
        // TODO: wire call — nFTOracle.updateETHUSDPriceFeed(newPriceFeed);
    }

    function nFTOracle_updateEmergencyCache(address collection) public asActor {
        // TODO: wire call — nFTOracle.updateEmergencyCache(collection);
    }
}
