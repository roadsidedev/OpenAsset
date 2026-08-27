// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IProviderConfigurator.sol";
import "../ProviderIds.sol";

interface IRobinhoodFeedRegistrar {
    function registerFeedWithTokenOraclePause(
        address market,
        address feed,
        uint256 maxStaleness,
        address l2Sequencer,
        address token
    ) external;
}

/**
 * @title RobinhoodProviderConfigurator
 * @notice Provider bundle initializer for Robinhood Stock Token markets.
 * @dev The factory remains the only caller. Provider data is encoded as:
 *      (feed, maxStaleness, l2Sequencer).
 *
 *      Robinhood token eligibility is intentionally supplied by a separate
 *      ManagedAllowlistComplianceAdapter. The configurator does not pretend
 *      that an ERC-20 transfer proves legal or geographic eligibility.
 */
contract RobinhoodProviderConfigurator is IProviderConfigurator {
    address public immutable factory;

    event RobinhoodMarketConfigured(address indexed market, address indexed collateralAsset, address indexed feed);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function providerId() external pure override returns (bytes32) {
        return ProviderIds.ROBINHOOD;
    }

    function configureMarket(
        address market,
        address collateralAsset,
        address,
        address oracleAdapter,
        address complianceAdapter,
        address,
        bytes calldata providerData
    ) external override onlyFactory {
        require(market != address(0) && collateralAsset != address(0), "Invalid market data");
        require(oracleAdapter != address(0) && complianceAdapter != address(0), "Robinhood adapters required");

        (address feed, uint256 maxStaleness, address l2Sequencer) = abi.decode(
            providerData,
            (address, uint256, address)
        );
        require(feed != address(0) && feed.code.length > 0, "Robinhood feed has no code");
        require(maxStaleness > 0, "Robinhood staleness required");
        require(l2Sequencer != address(0), "Robinhood sequencer required");
        require(l2Sequencer.code.length > 0, "Robinhood sequencer has no code");

        IRobinhoodFeedRegistrar(oracleAdapter).registerFeedWithTokenOraclePause(
            market,
            feed,
            maxStaleness,
            l2Sequencer,
            collateralAsset
        );
        emit RobinhoodMarketConfigured(market, collateralAsset, feed);
    }
}
