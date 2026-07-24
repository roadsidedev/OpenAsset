// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LendingMarketV2} from "./LendingMarketV2.sol";

/// @notice Standalone deployer for LendingMarketV2.
/// @dev Extracted from MarketFactoryV2 so the factory does not embed the market's full bytecode.
///      Follows the same pattern as Uniswap V3's Deployer contract.
contract MarketDeployer {
    /// @notice Deploy a new LendingMarketV2
    /// @return The address of the newly created market
    function deploy(
        address factory,
        address lpAddress,
        address collateralAsset,
        address lendingAsset,
        address protocolTreasury,
        address assetAdapter,
        address oracleAdapter,
        address complianceAdapter,
        address liquidationAdapter,
        address positionAdapter,
        uint256 ltvBps,
        uint256 aprBps,
        uint256 durationSeconds,
        uint256 gracePeriodHours,
        bool enableHealthFactor,
        uint256 healthFactorThreshold,
        LendingMarketV2.CircuitBreakerConfig memory cbConfig
    ) external returns (address) {
        LendingMarketV2 market = new LendingMarketV2(
            factory,
            lpAddress,
            collateralAsset,
            lendingAsset,
            protocolTreasury,
            assetAdapter,
            oracleAdapter,
            complianceAdapter,
            liquidationAdapter,
            positionAdapter,
            ltvBps,
            aprBps,
            durationSeconds,
            gracePeriodHours,
            enableHealthFactor,
            healthFactorThreshold,
            cbConfig
        );
        return address(market);
    }
}
