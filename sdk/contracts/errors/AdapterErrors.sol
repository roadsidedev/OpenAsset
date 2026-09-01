// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library AdapterErrors {
    error InvalidAddress();
    error InvalidAmount();
    error InvalidTimestamp();
    error OnlyFactory();
    error OnlyMarket();
    error UnconfiguredMarket();
    error DependencyUnavailable();
    error InvalidOutput();
}
