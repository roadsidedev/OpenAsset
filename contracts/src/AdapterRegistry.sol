// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AdapterRegistry
 * @notice Permissionless adapter registration with verification metadata
 * @dev Hybrid model: registration is open to anyone, but the registry
 *      attaches trust metadata (verified/unverified/deprecated) so market
 *      creators can make informed choices.
 *
 * Verification is a PROCESS control — it governs whether a human reviewer
 * has vouched for the code. It does NOT change how the core engine treats
 * the adapter at the code level. Both verified and unverified adapters are
 * called identically, and the engine independently verifies their outputs.
 *
 * Deprecation does NOT retroactively pause markets already using the adapter.
 * It blocks new selection, surfaces warnings on affected markets, and
 * notifies affected LPs.
 */
contract AdapterRegistry {
    // ============ Enums ============

    enum AdapterType { ASSET, ORACLE, COMPLIANCE, LIQUIDATION, POSITION }

    // ============ Structs ============

    struct AdapterInfo {
        address adapterAddress;
        AdapterType adapterType;
        address registeredBy;
        bool verified;
        bool deprecated;
        string auditReference;
        uint256 registeredAt;
        uint256 totalValueSecured;
    }

    // ============ Storage ============

    mapping(address => AdapterInfo) public adapters;
    address[] public allAdapters;
    mapping(AdapterType => address[]) public adaptersByType;
    mapping(AdapterType => uint256) public adapterCountByType;

    // Governance multisig for markVerified / markDeprecated
    address public auditGovernance;

    // ============ Events ============

    event AdapterRegistered(
        address indexed adapter,
        AdapterType indexed adapterType,
        address indexed registeredBy
    );

    event AdapterVerified(
        address indexed adapter,
        string auditReference
    );

    event AdapterDeprecated(
        address indexed adapter,
        string reason
    );

    event AuditGovernanceUpdated(
        address indexed oldGovernance,
        address indexed newGovernance
    );

    // ============ Errors ============

    error AlreadyRegistered();
    error NotRegistered();
    error Unauthorized();
    error InvalidAddress();

    // ============ Constructor ============

    constructor(address _auditGovernance) {
        if (_auditGovernance == address(0)) revert InvalidAddress();
        auditGovernance = _auditGovernance;
    }

    // ============ Modifiers ============

    modifier onlyAuditGovernance() {
        if (msg.sender != auditGovernance) revert Unauthorized();
        _;
    }

    // ============ Registration (Permissionless) ============

    /**
     * @notice Register a new adapter
     * @dev Permissionless — anyone can register an adapter conforming to
     *      one of the five interfaces. Registration does NOT imply verification.
     * @param adapter Address of the adapter contract
     * @param adapterType Which interface the adapter implements
     */
    function registerAdapter(address adapter, AdapterType adapterType) external {
        if (adapter == address(0)) revert InvalidAddress();
        if (adapters[adapter].adapterAddress != address(0)) revert AlreadyRegistered();

        adapters[adapter] = AdapterInfo({
            adapterAddress: adapter,
            adapterType: adapterType,
            registeredBy: msg.sender,
            verified: false,
            deprecated: false,
            auditReference: "",
            registeredAt: block.timestamp,
            totalValueSecured: 0
        });

        allAdapters.push(adapter);
        adaptersByType[adapterType].push(adapter);
        adapterCountByType[adapterType]++;

        emit AdapterRegistered(adapter, adapterType, msg.sender);
    }

    // ============ Verification (Governance Only) ============

    /**
     * @notice Mark an adapter as verified after internal audit
     * @dev Restricted to audit governance multisig. The auditReference
     *      should point to the audit firm/report identifier.
     * @param adapter Address of the adapter to verify
     * @param auditReference Audit firm/report identifier
     */
    function markVerified(address adapter, string calldata auditReference) external onlyAuditGovernance {
        if (adapters[adapter].adapterAddress == address(0)) revert NotRegistered();

        adapters[adapter].verified = true;
        adapters[adapter].auditReference = auditReference;

        emit AdapterVerified(adapter, auditReference);
    }

    /**
     * @notice Deprecate an adapter
     * @dev Restricted to audit governance multisig.
     *      Does NOT pause existing markets using this adapter.
     *      Blocks selection in new markets + surfaces warnings.
     * @param adapter Address of the adapter to deprecate
     * @param reason Reason for deprecation
     */
    function markDeprecated(address adapter, string calldata reason) external onlyAuditGovernance {
        if (adapters[adapter].adapterAddress == address(0)) revert NotRegistered();

        adapters[adapter].deprecated = true;

        emit AdapterDeprecated(adapter, reason);
    }

    // ============ Admin ============

    /**
     * @notice Update audit governance address
     * @param newGovernance New governance address
     */
    function setAuditGovernance(address newGovernance) external onlyAuditGovernance {
        if (newGovernance == address(0)) revert InvalidAddress();
        address old = auditGovernance;
        auditGovernance = newGovernance;
        emit AuditGovernanceUpdated(old, newGovernance);
    }

    // ============ View Functions ============

    /**
     * @notice Get adapter info
     * @param adapter Address of the adapter
     * @return info Adapter information struct
     */
    function getAdapterInfo(address adapter) external view returns (AdapterInfo memory) {
        if (adapters[adapter].adapterAddress == address(0)) revert NotRegistered();
        return adapters[adapter];
    }

    /**
     * @notice Check if an adapter is registered and valid for selection
     * @dev An adapter is selectable if registered AND not deprecated
     * @param adapter Address of the adapter
     * @return selectable True if registered and not deprecated
     */
    function isSelectable(address adapter) external view returns (bool) {
        AdapterInfo storage info = adapters[adapter];
        return info.adapterAddress != address(0) && !info.deprecated;
    }

    /**
     * @notice Get all adapters of a specific type
     * @param adapterType The type to filter by
     * @return result Array of adapter addresses
     */
    function getAdaptersByType(AdapterType adapterType) external view returns (address[] memory) {
        return adaptersByType[adapterType];
    }

    /**
     * @notice Get all registered adapters
     * @return result Array of all adapter addresses
     */
    function getAllAdapters() external view returns (address[] memory) {
        return allAdapters;
    }

    /**
     * @notice Get total number of registered adapters
     * @return count Total adapter count
     */
    function getTotalAdapterCount() external view returns (uint256) {
        return allAdapters.length;
    }
}
