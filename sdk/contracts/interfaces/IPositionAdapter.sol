// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPositionAdapter
 * @notice Handles how a loan position is represented and who can act on it
 * @dev Implementations: StandardPositionAdapter (no token),
 *      SoulboundPositionAdapter (non-transferable ERC721),
 *      TransferablePositionAdapter (transferable ERC721)
 *
 * The position adapter determines:
 * - Whether the position is visible in wallets (NFT vs internal struct)
 * - Whether the position can be sold/transferred
 * - Whether compliance checks are enforced on transfer
 *
 * For TransferablePosition + ComplianceAdapter combinations, the
 * transfer hook must call complianceAdapter.isEligible(recipient)
 * (Validation Matrix rule #1).
 */
interface IPositionAdapter {
    /**
     * @notice Mint a position token for a new loan
     * @dev Called during loan origination. For StandardPositionAdapter,
     *      this is a no-op. For NFT adapters, this mints an ERC721.
     * @param to Address to mint the position token to (the borrower)
     * @param loanId The loan ID this position represents
     */
    function mint(address to, uint256 loanId) external;

    /**
     * @notice Get the current owner of a position
     * @dev For StandardPositionAdapter, this returns the original borrower
     *      (positions cannot change hands). For TransferablePositionAdapter,
     *      this returns the current NFT holder (may differ from original borrower).
     * @param loanId The loan ID to query
     * @return owner Current address that owns this position
     */
    function ownerOf(uint256 loanId) external view returns (address);

    /**
     * @notice Burn a position token (on repay or liquidation)
     * @dev Called when a loan is repaid or liquidated. For StandardPositionAdapter,
     *      this is a no-op. For NFT adapters, this burns the ERC721.
     * @param loanId The loan ID whose position should be burned
     */
    function burn(uint256 loanId) external;
}
