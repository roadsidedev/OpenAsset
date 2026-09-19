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

    enum ReviewStatus { UNREVIEWED, IN_REVIEW, APPROVED, REJECTED }

    struct AdapterMetadata {
        string name;
        string version;
        address developer;
        string category;
        string supportedAssets;
        string documentationURI;
        string repositoryURI;
        string auditURI;
        ReviewStatus reviewStatus;
        uint256 usageCount;
    }

    // ============ Storage ============

    mapping(address => AdapterInfo) public adapters;
    mapping(address => AdapterMetadata) public adapterMetadata;
    address[] public allAdapters;
    mapping(AdapterType => address[]) public adaptersByType;
    mapping(AdapterType => uint256) public adapterCountByType;

    // Governance multisig for markVerified / markDeprecated
    address public auditGovernance;
    address public usageReporter;

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

    event AdapterMetadataUpdated(address indexed adapter, string name, string version, address indexed developer);
    event AdapterUsageRecorded(address indexed adapter, uint256 usageCount, uint256 valueSecured);
    event AdapterReviewStatusUpdated(address indexed adapter, ReviewStatus status, string reviewReference);
    event UsageReporterUpdated(address indexed oldReporter, address indexed newReporter);

    // ============ Errors ============

    error AlreadyRegistered();
    error NotRegistered();
    error Unauthorized();
    error InvalidAddress();

    // ============ Constructor ============

    constructor(address _auditGovernance) {
        if (_auditGovernance == address(0)) revert InvalidAddress();
        auditGovernance = _auditGovernance;
        usageReporter = _auditGovernance;
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
        _registerAdapter(adapter, adapterType, msg.sender);
    }

    function _registerAdapter(address adapter, AdapterType adapterType, address registrant) internal {
        if (adapter == address(0)) revert InvalidAddress();
        if (adapters[adapter].adapterAddress != address(0)) revert AlreadyRegistered();

        adapters[adapter] = AdapterInfo({
            adapterAddress: adapter,
            adapterType: adapterType,
            registeredBy: registrant,
            verified: false,
            deprecated: false,
            auditReference: "",
            registeredAt: block.timestamp,
            totalValueSecured: 0
        });

        allAdapters.push(adapter);
        adaptersByType[adapterType].push(adapter);
        adapterCountByType[adapterType]++;

        emit AdapterRegistered(adapter, adapterType, registrant);
        _setMetadata(adapter, "Unnamed adapter", "0.0.0", registrant, "", "", "", "", "");
    }

    /**
     * @notice Register an adapter with the metadata shown to market creators.
     * @dev Registration remains permissionless and starts as UNREVIEWED.
     */
    function registerAdapterWithMetadata(
        address adapter,
        AdapterType adapterType,
        string calldata name,
        string calldata version,
        string calldata category,
        string calldata supportedAssets,
        string calldata documentationURI,
        string calldata repositoryURI
    ) external {
        _registerAdapter(adapter, adapterType, msg.sender);
        _setMetadata(adapter, name, version, msg.sender, category, supportedAssets, documentationURI, repositoryURI, "");
    }

    function _setMetadata(
        address adapter,
        string memory name,
        string memory version,
        address developer,
        string memory category,
        string memory supportedAssets,
        string memory documentationURI,
        string memory repositoryURI,
        string memory auditURI
    ) internal {
        adapterMetadata[adapter] = AdapterMetadata({
            name: name,
            version: version,
            developer: developer,
            category: category,
            supportedAssets: supportedAssets,
            documentationURI: documentationURI,
            repositoryURI: repositoryURI,
            auditURI: auditURI,
            reviewStatus: ReviewStatus.UNREVIEWED,
            usageCount: 0
        });
        emit AdapterMetadataUpdated(adapter, name, version, developer);
    }

    /** @notice Update developer-owned descriptive metadata before review. */
    function updateMetadata(
        address adapter,
        string calldata name,
        string calldata version,
        string calldata category,
        string calldata supportedAssets,
        string calldata documentationURI,
        string calldata repositoryURI
    ) external {
        if (adapters[adapter].adapterAddress == address(0)) revert NotRegistered();
        AdapterMetadata storage metadata = adapterMetadata[adapter];
        if (metadata.developer != msg.sender) revert Unauthorized();
        metadata.name = name;
        metadata.version = version;
        metadata.category = category;
        metadata.supportedAssets = supportedAssets;
        metadata.documentationURI = documentationURI;
        metadata.repositoryURI = repositoryURI;
        emit AdapterMetadataUpdated(adapter, name, version, msg.sender);
    }

    /** @notice Record adapter usage from the configured protocol usage reporter. */
    function recordUsage(address adapter, uint256 valueSecured) external {
        if (msg.sender != usageReporter && msg.sender != auditGovernance) revert Unauthorized();
        if (adapters[adapter].adapterAddress == address(0)) revert NotRegistered();
        adapters[adapter].totalValueSecured += valueSecured;
        adapterMetadata[adapter].usageCount++;
        emit AdapterUsageRecorded(adapter, adapterMetadata[adapter].usageCount, valueSecured);
    }

    /** @notice Mark a registered adapter as actively under review. */
    function markInReview(address adapter) external onlyAuditGovernance {
        if (adapters[adapter].adapterAddress == address(0)) revert NotRegistered();
        adapterMetadata[adapter].reviewStatus = ReviewStatus.IN_REVIEW;
        emit AdapterReviewStatusUpdated(adapter, ReviewStatus.IN_REVIEW, "");
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
        adapterMetadata[adapter].reviewStatus = ReviewStatus.APPROVED;
        adapterMetadata[adapter].auditURI = auditReference;

        emit AdapterVerified(adapter, auditReference);
        emit AdapterReviewStatusUpdated(adapter, ReviewStatus.APPROVED, auditReference);
    }

    /** @notice Record a rejected review with a reproducible reason reference. */
    function markRejected(address adapter, string calldata reasonReference) external onlyAuditGovernance {
        if (adapters[adapter].adapterAddress == address(0)) revert NotRegistered();
        adapters[adapter].verified = false;
        adapters[adapter].deprecated = true; // rejected adapters must not remain selectable
        adapterMetadata[adapter].reviewStatus = ReviewStatus.REJECTED;
        adapterMetadata[adapter].auditURI = reasonReference;
        emit AdapterReviewStatusUpdated(adapter, ReviewStatus.REJECTED, reasonReference);
        emit AdapterDeprecated(adapter, reasonReference);
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

    /** @notice Return the discoverability and review metadata for an adapter. */
    function getAdapterMetadata(address adapter) external view returns (AdapterMetadata memory) {
        if (adapters[adapter].adapterAddress == address(0)) revert NotRegistered();
        return adapterMetadata[adapter];
    }

    // ============ Admin ============

    function setUsageReporter(address newReporter) external onlyAuditGovernance {
        if (newReporter == address(0)) revert InvalidAddress();
        address oldReporter = usageReporter;
        usageReporter = newReporter;
        emit UsageReporterUpdated(oldReporter, newReporter);
    }

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
     * @dev An adapter is selectable if registered AND verified AND not deprecated AND not rejected
     * @param adapter Address of the adapter
     * @return selectable True if registered and not deprecated
     */
    function isSelectable(address adapter) external view returns (bool) {
        AdapterInfo storage info = adapters[adapter];
        // Selectable only when registered, verified, not deprecated, and not rejected.
        return info.adapterAddress != address(0)
            && info.verified
            && !info.deprecated
            && adapterMetadata[adapter].reviewStatus != ReviewStatus.REJECTED;
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
