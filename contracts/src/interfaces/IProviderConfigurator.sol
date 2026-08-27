// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IProviderConfigurator
 * @notice Provider-specific atomic market initialization hook.
 * @dev The factory performs generic adapter validation and market deployment,
 *      then delegates only provider-specific registration to this interface.
 *      Implementations must be deterministic, fail closed, and callable only
 *      by their configured factory.
 */
interface IProviderConfigurator {
    function providerId() external view returns (bytes32);

    function configureMarket(
        address market,
        address collateralAsset,
        address assetAdapter,
        address oracleAdapter,
        address complianceAdapter,
        address liquidationAdapter,
        bytes calldata providerData
    ) external;
}
