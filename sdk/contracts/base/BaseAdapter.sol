// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../errors/AdapterErrors.sol";

/**
 * @title BaseAdapter
 * @notice Shared factory and configured-market guards for multi-tenant adapters.
 */
abstract contract BaseAdapter {
    address public immutable factory;
    mapping(address => bool) public configuredMarkets;

    modifier onlyFactory() {
        if (msg.sender != factory) revert AdapterErrors.OnlyFactory();
        _;
    }

    modifier onlyConfiguredMarket() {
        if (!configuredMarkets[msg.sender]) revert AdapterErrors.UnconfiguredMarket();
        _;
    }

    constructor(address factoryAddress) {
        if (factoryAddress == address(0)) revert AdapterErrors.InvalidAddress();
        factory = factoryAddress;
    }

    function _markConfigured(address market) internal {
        if (market == address(0)) revert AdapterErrors.InvalidAddress();
        configuredMarkets[market] = true;
    }
}
