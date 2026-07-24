// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IComplianceAdapter
 * @notice Handles participant eligibility checks
 * @dev Optional — a market with no compliance requirement simply has
 *      complianceAdapter == address(0) and skips these checks entirely.
 *
 * Implementations: ERC3643ComplianceAdapter, IssuerAllowlistAdapter,
 * JurisdictionGeofenceAdapter
 *
 * Checked at:
 * - Loan origination (always, if adapter is set)
 * - Position transfer (only for TransferablePosition markets, per Validation Matrix)
 *
 * FAIL-CLOSED: any revert from isEligible() is treated as false.
 */
interface IComplianceAdapter {
    /**
     * @notice Check if a participant is eligible to borrow or hold a position
     * @dev Returns false on any error (fail-closed). The engine never
     *      fails open on an unexpected revert from this adapter.
     * @param participant Address to check eligibility for
     * @return eligible True if the participant passes all compliance checks
     */
    function isEligible(address participant) external view returns (bool);
}
