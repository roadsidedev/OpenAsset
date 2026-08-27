// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IProviderConfigurator.sol";
import "../ProviderIds.sol";

interface IB20FeedRegistrar {
    function registerFeed(address market, address feed, uint256 maxStaleness, address l2Sequencer) external;
}

interface IB20TokenRegistrar {
    function registerToken(address market, address token) external;
}

/**
 * @title B20ProviderConfigurator
 * @notice Provider bundle initializer for Base B20 markets.
 * @dev The factory remains the only caller. The provider data is encoded as:
 *      (feed, maxStaleness, l2Sequencer).
 */
contract B20ProviderConfigurator is IProviderConfigurator {
    address public immutable factory;

    event B20MarketConfigured(address indexed market, address indexed collateralAsset, address indexed feed);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function providerId() external pure override returns (bytes32) {
        return ProviderIds.B20;
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
        require(oracleAdapter != address(0) && complianceAdapter != address(0), "B20 adapters required");

        (address feed, uint256 maxStaleness, address l2Sequencer) = abi.decode(
            providerData,
            (address, uint256, address)
        );
        require(feed != address(0) && feed.code.length > 0, "B20 feed has no code");
        require(maxStaleness > 0, "B20 staleness required");
        if (l2Sequencer != address(0)) {
            require(l2Sequencer.code.length > 0, "B20 sequencer has no code");
        }

        IB20FeedRegistrar(oracleAdapter).registerFeed(market, feed, maxStaleness, l2Sequencer);
        IB20TokenRegistrar(complianceAdapter).registerToken(market, collateralAsset);
        emit B20MarketConfigured(market, collateralAsset, feed);
    }
}
