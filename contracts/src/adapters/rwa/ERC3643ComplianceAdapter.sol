// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IComplianceAdapter.sol";

/**
 * @title IERC3643
 * @notice Minimal interface for ERC-3643 (T-REX) token compliance checks
 * @dev Interface for querying on-chain identity/compliance status
 */
interface IERC3643 {
    function isVerified(address _wallet) external view returns (bool);
    function isFrozen(address _wallet) external view returns (bool);
    function getFrozenTokens(address _wallet) external view returns (uint256);
}

/**
 * @title ERC3643ComplianceAdapter
 * @notice Reference compliance adapter for ERC-3643 (T-REX) token transfer restrictions
 * @dev Implements IComplianceAdapter by querying the ERC-3643 token's on-chain
 *      identity registry and freeze status.
 *
 * This adapter is a read-only query into the issuer's existing compliance layer.
 * It does not create, modify, or enforce any compliance rule — it reads the rules
 * the issuer has already deployed.
 *
 * Key behaviors:
 * - isEligible returns false if the token is frozen for the participant
 * - isEligible returns false if the issuer has not verified the participant's identity
 * - On any revert from the ERC-3643 contract, isEligible returns false (fail-closed)
 *
 * IMPORTANT: The LendingMarket contract itself (or a shared vault) must complete
 * the issuer's onboarding to become a whitelisted holder BEFORE any market can
 * escrow the token. This is a business-development task per issuer, not solved
 * by writing this adapter.
 */
contract ERC3643ComplianceAdapter is IComplianceAdapter {
    IERC3643 public immutable token;

    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        token = IERC3643(_token);
    }

    /// @inheritdoc IComplianceAdapter
    function isEligible(address participant) external view override returns (bool) {
        // Fail-closed: any revert = not eligible
        try token.isVerified(participant) returns (bool verified) {
            if (!verified) return false;
        } catch {
            return false;
        }

        try token.isFrozen(participant) returns (bool frozen) {
            if (frozen) return false;
        } catch {
            return false;
        }

        return true;
    }
}
