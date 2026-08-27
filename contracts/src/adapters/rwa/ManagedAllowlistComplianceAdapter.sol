// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IComplianceAdapter.sol";

/**
 * @title ManagedAllowlistComplianceAdapter
 * @notice Governance-managed, market-scoped eligibility checks.
 * @dev Used when an issuer's legal/geographic eligibility is not exposed as a
 *      public on-chain registry. The allowlist is fail-closed: an address is
 *      ineligible until explicitly approved for the specific market.
 *
 *      This contract does not claim to perform KYC, KYB, sanctions, or
 *      jurisdiction verification itself. The operator must complete those
 *      controls off-chain and only then set the corresponding wallet eligible.
 */
contract ManagedAllowlistComplianceAdapter is IComplianceAdapter {
    address public immutable factory;
    address public owner;

    mapping(address => bool) public configuredMarkets;
    mapping(address => mapping(address => bool)) public eligible;

    event MarketConfigured(address indexed market);
    event EligibilityUpdated(address indexed market, address indexed participant, bool eligible);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        owner = msg.sender;
    }

    function configure(address market) external override onlyFactory {
        require(market != address(0), "Invalid market");
        configuredMarkets[market] = true;
        emit MarketConfigured(market);
    }

    function setEligibility(address market, address participant, bool isEligible)
        external
        onlyOwner
    {
        require(configuredMarkets[market], "Market not configured");
        require(participant != address(0), "Invalid participant");
        eligible[market][participant] = isEligible;
        emit EligibilityUpdated(market, participant, isEligible);
    }

    function setEligibilityBatch(
        address market,
        address[] calldata participants,
        bool isEligible
    ) external onlyOwner {
        require(configuredMarkets[market], "Market not configured");
        for (uint256 i = 0; i < participants.length; i++) {
            require(participants[i] != address(0), "Invalid participant");
            eligible[market][participants[i]] = isEligible;
            emit EligibilityUpdated(market, participants[i], isEligible);
        }
    }

    function isEligible(address participant) external view override returns (bool) {
        if (!configuredMarkets[msg.sender] || participant == address(0)) return false;
        return eligible[msg.sender][participant];
    }

    function transferOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnerTransferred(oldOwner, newOwner);
    }
}
