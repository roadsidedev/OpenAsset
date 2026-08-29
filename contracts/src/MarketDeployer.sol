// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LendingMarketV2} from "./LendingMarketV2.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

/// @notice Standalone deployer for LendingMarketV2 — now clone-based to avoid 24KB limit.
/// @dev Holds a template LendingMarketV2 deployed once; each market is a minimal proxy clone.
contract MarketDeployer {
    address public immutable template;

    constructor(address _template) {
        require(_template != address(0), "Invalid template");
        template = _template;
    }

    /// @notice Deploy a new LendingMarketV2 clone and initialize it
    /// @return The address of the newly created market
    function deploy(LendingMarketV2.ConstructorParams memory params) external returns (address) {
        address clone = Clones.clone(template);
        LendingMarketV2(clone).initialize(params);
        return clone;
    }
}
