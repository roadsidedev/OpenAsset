// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IComplianceAdapter.sol";

/**
 * @title MockComplianceAdapter
 * @notice Test-only compliance adapter with configurable eligibility
 * @dev Implements IComplianceAdapter for testing the core engine
 */
contract MockComplianceAdapter is IComplianceAdapter {
    // Default eligibility for addresses not explicitly configured
    bool public defaultEligible;

    // Per-address eligibility overrides
    mapping(address => bool) public addressEligibility;
    mapping(address => bool) public hasOverride;

    // Configurable: if true, isEligible will revert (for testing fail-closed behavior)
    bool public shouldRevert;
    string public revertMessage;

    event EligibilitySet(address indexed participant, bool eligible);
    event DefaultEligibilitySet(bool eligible);

    constructor(bool _defaultEligible) {
        defaultEligible = _defaultEligible;
    }

    function setAddressEligible(address participant, bool eligible) external {
        addressEligibility[participant] = eligible;
        hasOverride[participant] = true;
        emit EligibilitySet(participant, eligible);
    }

    function setDefaultEligible(bool _default) external {
        defaultEligible = _default;
        emit DefaultEligibilitySet(_default);
    }

    function setRevert(bool _shouldRevert, string calldata _message) external {
        shouldRevert = _shouldRevert;
        revertMessage = _message;
    }

    function isEligible(address participant) external view override returns (bool) {
        if (shouldRevert) {
            revert(revertMessage);
        }
        if (hasOverride[participant]) {
            return addressEligibility[participant];
        }
        return defaultEligible;
    }
}
