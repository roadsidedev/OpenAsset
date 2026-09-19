// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LendingMarketV2} from "./LendingMarketV2.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

/// @notice Standalone deployer for LendingMarketV2 — clone-based to avoid the 24KB limit.
/// @dev Holds a template LendingMarketV2 deployed once; each market is a minimal proxy clone.
///      `deploy` is restricted to the factory so EOAs cannot bypass the Validation Matrix / fees.
contract MarketDeployer {
    address public immutable template;
    address public factory;
    address private immutable _owner;

    error OnlyFactory();
    error FactoryAlreadySet();
    error InvalidFactory();
    error NotOwner();

    constructor() {
        _owner = msg.sender;
        // Template is constructed with this deployer as the sole allowed initializer caller.
        template = address(new LendingMarketV2(address(this)));
    }

    /// @notice Wire the MarketFactoryV2 after it is constructed (one-shot).
    function setFactory(address _factory) external {
        if (msg.sender != _owner) revert NotOwner();
        if (factory != address(0)) revert FactoryAlreadySet();
        if (_factory == address(0)) revert InvalidFactory();
        factory = _factory;
    }

    /// @notice Deploy a new LendingMarketV2 clone and initialize it
    /// @dev Review M3/M4: fail-closed parameter validation lives HERE (not in the
    ///      template's initialize, which must stay under the 24KB deploy limit).
    ///      Only the factory may call this — closing the unrestricted-deploy finding.
    /// @return The address of the newly created market
    function deploy(LendingMarketV2.ConstructorParams memory params) external returns (address) {
        if (msg.sender != factory) revert OnlyFactory();
        require(params.marketOwner != address(0), "Invalid market owner");
        require(params.collateralAsset != address(0), "Invalid collateral asset");
        require(params.lendingAsset != address(0), "Invalid lending asset");
        require(params.protocolTreasury != address(0), "Invalid protocol treasury");
        require(params.assetAdapter != address(0), "Invalid asset adapter");
        require(params.oracleAdapter != address(0), "Invalid oracle adapter");
        require(params.liquidationAdapter != address(0), "Invalid liquidation adapter");
        require(params.positionAdapter != address(0), "Invalid position adapter");
        require(params.ltvBps > 0 && params.ltvBps <= 10000, "Invalid LTV");
        require(params.durationSeconds > 0, "Invalid duration");
        if (params.enableHealthFactor) {
            // Threshold is bps-scaled (10000 = 1.0x); a raw "1.5" would silently disable HF liquidation
            require(params.healthFactorThreshold > 10000, "Invalid HF threshold");
        }
        // Circuit breaker: a zero resume threshold or missing lookback can never
        // resume; a zero pause threshold pauses on the first nonzero tick.
        if (params.cbConfig.enabled) {
            require(params.cbConfig.pauseThresholdBps > 0, "Invalid CB pause threshold");
            require(params.cbConfig.resumeThresholdBps > 0, "Invalid CB resume threshold");
            require(params.cbConfig.resumeThresholdBps <= params.cbConfig.pauseThresholdBps, "Invalid CB resume bound");
            require(params.cbConfig.lookbackPeriodSeconds > 0, "Invalid CB lookback");
        }
        address clone = Clones.clone(template);
        LendingMarketV2(clone).initialize(params);
        return clone;
    }
}
