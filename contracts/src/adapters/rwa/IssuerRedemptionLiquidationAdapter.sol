// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/ILiquidationAdapter.sol";
import "../../interfaces/adapters/IComplianceAdapter.sol";

/**
 * @title IIssuerRedemption
 * @notice Minimal interface for issuer redemption settlement channel
 * @dev Each issuer has their own settlement mechanism. This interface
 *      provides the minimal integration surface.
 */
interface IIssuerRedemption {
    function submitRedemption(
        address tokenAddress,
        address holder,
        uint256 amount
    ) external returns (uint256 redemptionId, uint256 expectedSettlementTime);

    function checkSettlement(uint256 redemptionId) external view returns (bool settled, uint256 proceeds);
}

/**
 * @title IssuerRedemptionLiquidationAdapter
 * @notice Multi-tenant liquidation adapter for RWA / tokenized equity with issuer redemption
 * @dev Implements ILiquidationAdapter with async liquidation and multi-tenancy:
 *      1. Loan enters LIQUIDATION_CURE (reversible state)
 *      2. During cure window, holder can repay frozen debt + penalty
 *      3. After cure window expires, redemption is submitted to issuer
 *      4. Settlement confirms asynchronously
 *
 *      Multi-tenancy: factory calls configure() once per market. Each market
 *      specifies its issuer redemption contract, token address, and cure window.
 */
contract IssuerRedemptionLiquidationAdapter is ILiquidationAdapter {
    address public immutable factory;

    struct MarketConfig {
        IIssuerRedemption issuerRedemption;
        address tokenAddress;
        address assetAdapter;
        uint256 cureWindow;
        bool isActive;
    }

    mapping(address => MarketConfig) public marketConfigs;
    mapping(uint256 => uint256) public loanRedemptionId;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyConfiguredMarket() {
        require(marketConfigs[msg.sender].isActive, "Unconfigured market");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function configure(address market, address assetAdapter) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(assetAdapter != address(0), "Invalid asset adapter");
        marketConfigs[market].assetAdapter = assetAdapter;
        marketConfigs[market].isActive = true;
    }

    /**
     * @notice Register issuer redemption details for a market (factory only)
     * @param market Address of the LendingMarket contract
     * @param redemptionContract Issuer redemption contract address
     * @param token Token address to redeem
     * @param _cureWindowSeconds Duration of the cure window
     */
    function registerIssuer(
        address market,
        address redemptionContract,
        address token,
        uint256 _cureWindowSeconds
    ) external onlyFactory {
        require(market != address(0), "Invalid market");
        require(redemptionContract != address(0), "Invalid redemption contract");
        require(token != address(0), "Invalid token address");
        require(_cureWindowSeconds > 0, "Cure window must be > 0");

        marketConfigs[market].issuerRedemption = IIssuerRedemption(redemptionContract);
        marketConfigs[market].tokenAddress = token;
        marketConfigs[market].cureWindow = _cureWindowSeconds;
    }

    event RedemptionSubmitted(uint256 indexed loanId, uint256 redemptionId, uint256 amount);
    event SettlementConfirmed(uint256 indexed loanId, uint256 proceeds);

    /// @inheritdoc ILiquidationAdapter
    function liquidate(uint256 loanId, uint256 debtOwed)
        external
        override
        onlyConfiguredMarket
        returns (uint256 recoveredForLP, uint256 returnedToHolder)
    {
        MarketConfig storage config = marketConfigs[msg.sender];
        require(address(config.issuerRedemption) != address(0), "Issuer not configured");

        (uint256 redemptionId, ) = config.issuerRedemption.submitRedemption(
            config.tokenAddress,
            msg.sender,
            debtOwed
        );

        loanRedemptionId[loanId] = redemptionId;
        emit RedemptionSubmitted(loanId, redemptionId, debtOwed);

        recoveredForLP = 0;
        returnedToHolder = 0;
    }

    /// @inheritdoc ILiquidationAdapter
    function isAsynchronous() external pure override returns (bool) {
        return true;
    }

    /// @inheritdoc ILiquidationAdapter
    function cureWindowSeconds() external view override returns (uint256) {
        return marketConfigs[msg.sender].cureWindow;
    }

    function requiresCollateralHandoff() external pure override returns (bool) {
        return false;
    }

    /**
     * @notice Check if a redemption has settled (called by keepers)
     * @param loanId The loan to check
     */
    function checkSettlement(uint256 loanId) external view returns (bool settled, uint256 proceeds) {
        uint256 redemptionId = loanRedemptionId[loanId];
        if (redemptionId == 0) return (false, 0);

        MarketConfig storage config = marketConfigs[msg.sender];
        return config.issuerRedemption.checkSettlement(redemptionId);
    }
}
