// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ProviderIds {
    bytes32 internal constant B20 = keccak256("OPENASSET_PROVIDER_B20");
    bytes32 internal constant ROBINHOOD = keccak256("OPENASSET_PROVIDER_ROBINHOOD");
}
