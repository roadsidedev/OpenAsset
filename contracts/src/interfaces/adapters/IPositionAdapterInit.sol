// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPositionAdapter.sol";

/**
 * @title IPositionAdapterInit
 * @notice Extension of IPositionAdapter for clone-template position adapters
 * @dev Position adapter implementations that use the clone-template pattern
 *      (EIP-1167 minimal proxy) must implement this interface instead of
 *      IPositionAdapter directly. The factory deploys a minimal proxy and
 *      calls initialize() to set up the clone's storage.
 *
 *      All three reference implementations follow this pattern.
 */
interface IPositionAdapterInit is IPositionAdapter {
    /**
     * @notice Initialize a cloned position adapter instance
     * @dev Called once by the factory immediately after deploying the
     *      minimal proxy. Must use OpenZeppelin's Initializable to guard
     *      against re-initialization.
     * @param factory Address of the MarketFactory that deployed this clone
     * @param complianceAdapter Address of the ComplianceAdapter, or address(0)
     */
    function initialize(address factory, address complianceAdapter) external;
}
