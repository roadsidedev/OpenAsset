// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILiquidationAdapter
 * @notice Handles default resolution for the lending engine
 * @dev Implementations: DEXSwapLiquidationAdapter, NFTAuctionLiquidationAdapter,
 *      IssuerRedemptionLiquidationAdapter
 *
 * Gradual liquidation is NOT a separate adapter — it is a structural requirement
 * of this interface. Every implementation must return both recoveredForLP and
 * returnedToHolder, forcing the adapter to account for surplus rather than
 * treating "take everything" as an acceptable default.
 *
 * The engine verifies that:
 *   recoveredForLP + returnedToHolder reconciles against the actual asset
 *   received back from escrow (Section 4, Adapter Trust Model).
 */
interface ILiquidationAdapter {
    /**
     * @notice Execute liquidation of a defaulted loan
     * @dev Must return both values to enforce the gradual liquidation shape.
     *      For divisible assets (ERC20): return genuine token surplus.
     *      For indivisible assets (ERC721): return 0 in token terms, pay
     *      surplus as a cash side-payment from LP's available liquidity.
     *      For async adapters (issuer redemption): submit the redemption
     *      request and return the expected amounts (confirmation comes later).
     * @param loanId The loan to liquidate
     * @param debtOwed Total debt owed (principal + interest + penalty)
     * @return recoveredForLP Value taken to satisfy debt + penalty
     * @return returnedToHolder Surplus returned to the position holder
     */
    function liquidate(uint256 loanId, uint256 debtOwed)
        external
        returns (uint256 recoveredForLP, uint256 returnedToHolder);

    /**
     * @notice Whether this adapter operates asynchronously
     * @dev Async adapters (e.g., IssuerRedemptionLiquidationAdapter) route
     *      through LIQUIDATION_CURE / LIQUIDATION_SETTLING instead of
     *      resolving in one transaction. See Section 8 of the Technical Reference.
     * @return asynchronous True if liquidation requires multi-step settlement
     */
    function isAsynchronous() external view returns (bool);

    /**
     * @notice Duration of the cure window for async adapters
     * @dev Only meaningful when isAsynchronous() == true. Defines how long
     *      a loan sits in LIQUIDATION_CURE before the redemption is
     *      irreversibly submitted. Different issuers have different real-world
     *      cutoffs for cancelling a submitted redemption instruction.
     * @return seconds Duration of the cure window in seconds
     */
    function cureWindowSeconds() external view returns (uint256);
}
