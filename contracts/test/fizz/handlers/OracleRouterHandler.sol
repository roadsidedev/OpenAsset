// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with OracleRouter
abstract contract OracleRouterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function oracleRouter_configureOracle_clamped(address asset, address primaryOracle, address secondaryOracle, address tertiaryOracle, bool useAutomaticFallback, uint256 maxPriceAge) public {
        // TODO: clamp asset — e.g. asset = toActor(asset);
        // TODO: clamp primaryOracle — e.g. primaryOracle = toActor(primaryOracle);
        // TODO: clamp secondaryOracle — e.g. secondaryOracle = toActor(secondaryOracle);
        // TODO: clamp tertiaryOracle — e.g. tertiaryOracle = toActor(tertiaryOracle);
        // TODO: clamp maxPriceAge — e.g. maxPriceAge = clampBetween(maxPriceAge, min, max);
        oracleRouter_configureOracle(asset, primaryOracle, secondaryOracle, tertiaryOracle, useAutomaticFallback, maxPriceAge);
    }

    function oracleRouter_configureOracleBatch_clamped(address[] memory assets, address[] memory primaryOracles, address[] memory secondaryOracles, address[] memory tertiaryOracles, uint256[] memory maxPriceAges, bool useAutomaticFallback) public {
        oracleRouter_configureOracleBatch(assets, primaryOracles, secondaryOracles, tertiaryOracles, maxPriceAges, useAutomaticFallback);
    }

    function oracleRouter_disableOracle_clamped(address oracle) public {
        // TODO: clamp oracle — e.g. oracle = toActor(oracle);
        oracleRouter_disableOracle(oracle);
    }

    function oracleRouter_enableOracle_clamped(address oracle) public {
        // TODO: clamp oracle — e.g. oracle = toActor(oracle);
        oracleRouter_enableOracle(oracle);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function oracleRouter_configureOracle(address asset, address primaryOracle, address secondaryOracle, address tertiaryOracle, bool useAutomaticFallback, uint256 maxPriceAge) public asActor {
        // TODO: wire call — oracleRouter.configureOracle(asset, primaryOracle, secondaryOracle, tertiaryOracle, useAutomaticFallback, maxPriceAge);
    }

    function oracleRouter_configureOracleBatch(address[] memory assets, address[] memory primaryOracles, address[] memory secondaryOracles, address[] memory tertiaryOracles, uint256[] memory maxPriceAges, bool useAutomaticFallback) public asActor {
        // TODO: wire call — oracleRouter.configureOracleBatch(assets, primaryOracles, secondaryOracles, tertiaryOracles, maxPriceAges, useAutomaticFallback);
    }

    function oracleRouter_disableOracle(address oracle) public asActor {
        // TODO: wire call — oracleRouter.disableOracle(oracle);
    }

    function oracleRouter_enableOracle(address oracle) public asActor {
        // TODO: wire call — oracleRouter.enableOracle(oracle);
    }
}
