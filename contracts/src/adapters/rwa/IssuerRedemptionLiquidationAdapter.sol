// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/ILiquidationAdapter.sol";

/**
 * @title IIssuerRedemption
 * @notice Minimal interface for issuer redemption settlement channel
 * @dev Each issuer has their own settlement mechanism. This interface
 *      provides the minimal integration surface.
 */
interface IIssuerRedemption {
    /**
     * @notice Submit a redemption request to the issuer
     * @param tokenAddress The token to redeem
     * @param holder The address requesting redemption
     * @param amount The amount to redeem
     * @return redemptionId Issuer's internal redemption tracking ID
     * @return expectedSettlementTime Estimated seconds until settlement
     */
    function submitRedemption(
        address tokenAddress,
        address holder,
        uint256 amount
    ) external returns (uint256 redemptionId, uint256 expectedSettlementTime);

    /**
     * @notice Check if a redemption has been settled
     * @param redemptionId The redemption to check
     * @return settled Whether settlement is complete
     * @return proceeds Amount returned from the redemption
     */
    function checkSettlement(uint256 redemptionId) external view returns (bool settled, uint256 proceeds);
}

/**
 * @title IssuerRedemptionLiquidationAdapter
 * @notice Reference liquidation adapter for RWA / tokenized equity with issuer mint-burn channel
 * @dev Implements ILiquidationAdapter with async liquidation:
 *
 *      1. Loan enters LIQUIDATION_CURE (reversible state)
 *      2. During cure window, holder can repay frozen debt + penalty
 *      3. After cure window expires, redemption is submitted to issuer
 *      4. Settlement confirms asynchronously
 *
 * isAsynchronous() returns true — the core engine routes through
 * LIQUIDATION_CURE / LIQUIDATION_SETTLING instead of resolving in one transaction.
 *
 * Different issuers have different real-world cutoffs for cancelling submitted
 * redemption instructions. cureWindowSeconds() returns the issuer-specific window.
 */
contract IssuerRedemptionLiquidationAdapter is ILiquidationAdapter {
    IIssuerRedemption public immutable issuerRedemption;
    address public immutable tokenAddress;
    uint256 public immutable cureWindow;

    // Tracking
    mapping(uint256 => uint256) public loanRedemptionId; // loanId => redemptionId

    event RedemptionSubmitted(uint256 indexed loanId, uint256 redemptionId, uint256 amount);
    event SettlementConfirmed(uint256 indexed loanId, uint256 proceeds);

    constructor(
        address _issuerRedemption,
        address _tokenAddress,
        uint256 _cureWindow
    ) {
        require(_issuerRedemption != address(0), "Invalid redemption contract");
        require(_tokenAddress != address(0), "Invalid token address");
        require(_cureWindow > 0, "Cure window must be > 0");

        issuerRedemption = IIssuerRedemption(_issuerRedemption);
        tokenAddress = _tokenAddress;
        cureWindow = _cureWindow;
    }

    /// @inheritdoc ILiquidationAdapter
    function liquidate(uint256 loanId, uint256 debtOwed)
        external
        override
        returns (uint256 recoveredForLP, uint256 returnedToHolder)
    {
        (uint256 redemptionId, ) = issuerRedemption.submitRedemption(
            tokenAddress,
            msg.sender,
            debtOwed
        );

        loanRedemptionId[loanId] = redemptionId;
        emit RedemptionSubmitted(loanId, redemptionId, debtOwed);

        // Return 0 — settlement confirmation will update the actual recovery amount
        // The engine MUST NOT add this to availableLiquidity until confirmed
        recoveredForLP = 0;
        returnedToHolder = 0;
    }

    /// @inheritdoc ILiquidationAdapter
    function isAsynchronous() external pure override returns (bool) {
        return true;
    }

    /// @inheritdoc ILiquidationAdapter
    function cureWindowSeconds() external view override returns (uint256) {
        return cureWindow;
    }

    /**
     * @notice Check if a redemption has settled (called by keepers)
     * @param loanId The loan to check
     * @return settled Whether the redemption has been confirmed
     * @return proceeds The actual proceeds from settlement
     */
    function checkSettlement(uint256 loanId) external view returns (bool settled, uint256 proceeds) {
        uint256 redemptionId = loanRedemptionId[loanId];
        if (redemptionId == 0) return (false, 0);

        return issuerRedemption.checkSettlement(redemptionId);
    }
}
