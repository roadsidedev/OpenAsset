// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IComplianceAdapter.sol";

/**
 * @title MockComplianceAdapter
 * @notice Test-only compliance adapter with configurable eligibility
 * @dev Implements IComplianceAdapter for testing the core engine
 */
contract MockComplianceAdapter is IComplianceAdapter {
    bool public defaultEligible;
    mapping(address => bool) public addressEligibility;
    mapping(address => bool) public hasOverride;
    bool public shouldRevert;
    string public revertMessage;

    event EligibilitySet(address indexed participant, bool eligible);
    event DefaultEligibilitySet(bool eligible);

    constructor(bool _defaultEligible) {
        defaultEligible = _defaultEligible;
    }

    function configure(address) external {
        // No-op for test mock
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
