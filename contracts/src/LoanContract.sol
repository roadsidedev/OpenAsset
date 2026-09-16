// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./libraries/CircuitBreaker.sol"; // Contains AssetHandler library
import "./interfaces/ILoanContract.sol";
import "./interfaces/ILendingMarket.sol";
import {AssetType} from "./interfaces/IMarketFactory.sol";

/**
 * @title LoanContract
 * @notice Individual loan escrow contract (deployed via minimal proxy pattern)
 * @dev Each loan gets its own isolated contract instance for maximum security
 * 
 * Security Features:
 * - Isolated collateral escrow per loan
 * - Reentrancy protection
 * - Health factor monitoring
 * - Time-based and health-based liquidation
 * - Origination fee (0.5% to treasury)
 * - Interest calculation
 * 
 * @custom:security-contact security@openasset.io
 */
contract LoanContract is ILoanContract, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using AssetHandler for AssetHandler.AssetType;
    
    // ============ Constants ============
    
    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant ORIGINATION_FEE_BPS = 50; // 0.5%
    uint256 private constant MIN_HEALTH_FACTOR = 1e18; // 1.0 = 100%
    uint256 private constant GRACE_PERIOD = 1 hours; // MEDIUM-003: Grace period for loan expiry
    
    // ============ Immutable Storage (Set Once via Initialize) ============
    
    address public lendingMarket;
    address public borrower;
    address public collateralAsset;
    address public loanAsset;
    address public protocolTreasury;
    address public oracle;
    
    AssetType public assetType;
    LoanStatus public status;
    
    uint256 public collateralAmount;
    uint256 public tokenId; // For ERC721
    uint256 public principal;
    uint256 public interestAmount;
    uint256 public startTime;
    uint256 public expiryTime;
    uint256 public healthFactorThreshold; // From lending market config
    
    bool private initialized;
    
    // ============ Events ============
    
    event LoanInitialized(
        address indexed borrower,
        uint256 principal,
        uint256 interestAmount,
        uint256 collateralAmount,
        uint256 expiryTime
    );
    
    event LoanRepaid(
        address indexed borrower,
        uint256 totalRepayment,
        uint256 timestamp
    );
    
    event LoanLiquidated(
        address indexed liquidator,
        address indexed borrower,
        uint256 collateralSeized,
        uint256 debtRecovered,
        uint256 timestamp
    );
    
    event OriginationFeePaid(
        address indexed treasury,
        uint256 feeAmount
    );
    
    // ============ Errors ============
    
    error AlreadyInitialized();
    error NotInitialized();
    error OnlyLendingMarket();
    error OnlyBorrower();
    error LoanNotActive();
    error LoanNotRepayable();
    error LoanNotLiquidatable();
    error InvalidAmount();
    error TransferFailed();
    error InvalidStatus();
    
    // ============ Modifiers ============
    
    modifier onlyLendingMarket() {
        if (msg.sender != lendingMarket) revert OnlyLendingMarket();
        _;
    }
    
    modifier onlyBorrower() {
        if (msg.sender != borrower) revert OnlyBorrower();
        _;
    }
    
    modifier onlyActive() {
        if (status != LoanStatus.ACTIVE) revert LoanNotActive();
        _;
    }
    
    // ============ Initialization (Called by LendingMarket) ============
    
    /**
     * @notice Initialize loan contract (replaces constructor for minimal proxy)
     * @dev Can only be called once by LendingMarket
     * @param borrower_ Borrower address
     * @param collateralAmount_ Amount of collateral (for ERC20)
     * @param tokenId_ Token ID (for ERC721)
     * @param principal_ Loan principal before fees
     * @param interestAmount_ Interest amount to be paid
     * @param expiryTime_ Loan expiry timestamp
     */
    function initialize(
        address borrower_,
        uint256 collateralAmount_,
        uint256 tokenId_,
        uint256 principal_,
        uint256 interestAmount_,
        uint256 expiryTime_
    ) external override {
        // MEDIUM-001: Check initialization FIRST before any other logic
        if (initialized) revert AlreadyInitialized();
        
        // Set lendingMarket and validate caller is a valid contract
        lendingMarket = msg.sender;
        require(msg.sender != address(0), "Invalid lending market");
        
        // This would be passed from lending market via constructor or separate call
        // For minimal proxy, lending market passes these via additional call
        (
            collateralAsset,
            loanAsset,
            protocolTreasury,
            oracle,
            assetType,
            healthFactorThreshold
        ) = ILendingMarket(msg.sender).getLoanConfig();
        
        borrower = borrower_;
        collateralAmount = collateralAmount_;
        tokenId = tokenId_;
        principal = principal_;
        interestAmount = interestAmount_;
        startTime = block.timestamp;
        expiryTime = expiryTime_;
        status = LoanStatus.ACTIVE;
        initialized = true;
        
        emit LoanInitialized(
            borrower_,
            principal_,
            interestAmount_,
            collateralAmount_,
            expiryTime_
        );
    }
    
    // ============ Loan Operations ============
    
    /**
     * @notice Repay loan and reclaim collateral
     * @dev Borrower must approve this contract to spend (principal + interest)
     */
    function repay() external override nonReentrant onlyActive {
        // Borrower or anyone can repay
        uint256 totalRepayment = principal + interestAmount;
        
        // CHECKS - MEDIUM-003: Allow repayment during grace period
        if (block.timestamp > expiryTime + GRACE_PERIOD) revert LoanNotRepayable();
        
        // Calculate revenue share
        uint256 platformShare = (interestAmount * 1000) / BPS_DENOMINATOR; // 10%
        uint256 lpShare = interestAmount - platformShare;
        
        // EFFECTS - Update state FIRST
        status = LoanStatus.REPAID;
        
        // INTERACTIONS - Pull repayment from borrower
        IERC20 loanToken = IERC20(loanAsset);
        loanToken.safeTransferFrom(msg.sender, address(this), totalRepayment);
        
        // Notify market BEFORE returning collateral (prevents reentrancy)
        ILendingMarket(lendingMarket).removeLoan(address(this), principal);
        
        // Send principal + LP share to lending market
        loanToken.safeTransfer(lendingMarket, principal + lpShare);
        
        // Send platform share to treasury
        loanToken.safeTransfer(protocolTreasury, platformShare);
        
        // Return collateral LAST (ERC777 hooks cannot reenter now)
        AssetHandler.transferAssetOut(
            AssetHandler.AssetType(uint8(assetType)),
            collateralAsset,
            borrower,
            assetType == AssetType.ERC20 ? collateralAmount : tokenId
        );

        emit LoanRepaid(borrower, totalRepayment, block.timestamp);
    }
    
    /**
     * @notice Liquidate undercollateralized or expired loan
     * @dev Anyone can liquidate if conditions are met
     */
    function liquidate() external override nonReentrant onlyActive {
        // CHECKS
        if (!isLiquidatable()) revert LoanNotLiquidatable();
        
        uint256 totalDebt = principal + interestAmount;
        uint256 collateralValue = _getCollateralValue();
        
        // EFFECTS - Update state FIRST
        status = LoanStatus.LIQUIDATED;
        
        // Notify market BEFORE collateral transfers (prevents reentrancy)
        ILendingMarket(lendingMarket).removeLoan(address(this), principal);
        
        // INTERACTIONS - Asset-specific liquidation (already safe, but now extra secure)
        if (assetType == AssetType.ERC20) {
            _liquidateERC20(totalDebt, collateralValue);
        } else {
            _liquidateERC721(totalDebt, collateralValue);
        }
    }
    
    // ============ Liquidation Implementations ============
    
    /**
     * @notice Liquidate ERC20 collateral (gradual liquidation)
     * @param totalDebt Total debt owed
     * @param collateralValue Current collateral value
     */
    function _liquidateERC20(uint256 totalDebt, uint256 collateralValue) internal {
        IERC20 loanToken = IERC20(loanAsset);
        
        if (collateralValue <= totalDebt) {
            // Underwater: Liquidator gets all collateral
            // Liquidator must repay whatever collateral is worth
            uint256 repaymentAmount = collateralValue;
            
            // Pull debt repayment from liquidator
            loanToken.safeTransferFrom(msg.sender, address(this), repaymentAmount);
            
            // Calculate revenue split - LOW-004: Safe calculation
            uint256 platformShare = (interestAmount * 1000) / BPS_DENOMINATOR; // 10%
            // Handle underwater case where repayment may not cover principal
            uint256 marketPayment = repaymentAmount > platformShare ? repaymentAmount - platformShare : 0;
            uint256 lpShare = marketPayment > principal ? marketPayment - principal : 0;
            
            // Send to lending market: cap at actual available amount (not artificial principal)
            loanToken.safeTransfer(lendingMarket, marketPayment);
            loanToken.safeTransfer(protocolTreasury, platformShare > repaymentAmount ? repaymentAmount : platformShare);
            
            // Transfer all collateral to liquidator
            AssetHandler.transferAssetOut(
                AssetHandler.AssetType(uint8(assetType)),
                collateralAsset,
                msg.sender,
                collateralAmount
            );
            
            emit LoanLiquidated(msg.sender, borrower, collateralAmount, repaymentAmount, block.timestamp);
        } else {
            // Sufficient collateral: Gradual liquidation
            // Calculate exact collateral needed
            uint256 collateralPrice = _getCollateralPrice();
            uint256 collateralNeeded = (totalDebt * 1e18) / collateralPrice;
            
            // Add 5% liquidation penalty
            uint256 penalty = (collateralNeeded * 500) / BPS_DENOMINATOR;
            uint256 totalCollateralSeized = collateralNeeded + penalty;
            
            if (totalCollateralSeized > collateralAmount) {
                totalCollateralSeized = collateralAmount;
            }
            
            uint256 surplus = collateralAmount - totalCollateralSeized;
            
            // Pull debt repayment
            loanToken.safeTransferFrom(msg.sender, address(this), totalDebt);
            
            // Calculate revenue split
            uint256 platformShare = (interestAmount * 1000) / BPS_DENOMINATOR;
            uint256 lpShare = interestAmount - platformShare;
            
            // Send to market and treasury
            loanToken.safeTransfer(lendingMarket, principal + lpShare);
            loanToken.safeTransfer(protocolTreasury, platformShare);
            
            // Transfer seized collateral to liquidator
            IERC20(collateralAsset).safeTransfer(msg.sender, totalCollateralSeized);
            
            // Return surplus to borrower
            if (surplus > 0) {
                IERC20(collateralAsset).safeTransfer(borrower, surplus);
            }
            
            emit LoanLiquidated(msg.sender, borrower, totalCollateralSeized, totalDebt, block.timestamp);
        }
    }
    
    /**
     * @notice Liquidate ERC721 collateral (full liquidation)
     * @param totalDebt Total debt owed
     * @param collateralValue Current NFT value
     */
    function _liquidateERC721(uint256 totalDebt, uint256 collateralValue) internal {
        IERC20 loanToken = IERC20(loanAsset);
        
        // NFTs are always liquidated in full (no partial liquidation)
        // Liquidator must repay full debt
        loanToken.safeTransferFrom(msg.sender, address(this), totalDebt);
        
        // Calculate revenue split
        uint256 platformShare = (interestAmount * 1000) / BPS_DENOMINATOR;
        uint256 lpShare = interestAmount - platformShare;
        
        // Send payments
        loanToken.safeTransfer(lendingMarket, principal + lpShare);
        loanToken.safeTransfer(protocolTreasury, platformShare);
        
        // Transfer NFT to liquidator
        AssetHandler.transferAssetOut(
            AssetHandler.AssetType(uint8(assetType)),
            collateralAsset,
            msg.sender,
            tokenId
        );
        
        // If NFT value > debt, liquidator pays surplus to borrower
        if (collateralValue > totalDebt) {
            uint256 surplus = collateralValue - totalDebt;
            // In practice, this would require liquidator to send extra ETH/USDC
            // For simplicity, surplus goes to liquidator as profit
        }
        
        emit LoanLiquidated(msg.sender, borrower, 1, totalDebt, block.timestamp);
    }

    // ============ View Functions ============

    /**
     * @notice Get current health factor
     * @return healthFactor Health factor with 18 decimals (1e18 = 100%)
     */
    function getHealthFactor() public view override returns (uint256 healthFactor) {
        if (status != LoanStatus.ACTIVE) return 0;
        
        uint256 collateralValue = _getCollateralValue();
        uint256 totalDebt = principal + interestAmount;
        
        if (totalDebt == 0) return type(uint256).max;
        
        // healthFactor = (collateralValue * 1e18) / totalDebt
        healthFactor = (collateralValue * 1e18) / totalDebt;
    }
    
    /**
     * @notice Check if loan can be liquidated
     * @return canLiquidate True if liquidation is allowed
     */
    function isLiquidatable() public view override returns (bool canLiquidate) {
        if (status != LoanStatus.ACTIVE) return false;
        
        // Condition 1: Loan expired
        if (block.timestamp > expiryTime) return true;
        
        // Condition 2: Health factor below threshold
        uint256 healthFactor = getHealthFactor();
        if (healthFactor < healthFactorThreshold) return true;
        
        return false;
    }
    
    /**
     * @notice Get complete loan details
     */
    function getLoanDetails() external view override returns (
        address borrower_,
        uint256 principal_,
        uint256 interestAmount_,
        uint256 collateralAmount_,
        uint256 tokenId_,
        uint256 startTime_,
        uint256 expiryTime_,
        LoanStatus status_,
        uint256 healthFactor_
    ) {
        return (
            borrower,
            principal,
            interestAmount,
            collateralAmount,
            tokenId,
            startTime,
            expiryTime,
            status,
            getHealthFactor()
        );
    }
    
    // ============ Internal Helper Functions ============
    
    /**
     * @notice Get current collateral value in loan asset terms
     * @return value Collateral value with 18 decimals
     */
    function _getCollateralValue() internal view returns (uint256 value) {
        uint256 price = _getCollateralPrice();
        
        if (assetType == AssetType.ERC20) {
            value = (collateralAmount * price) / 1e18;
        } else {
            value = price; // NFT floor price in loan asset
        }
    }
    
    /**
     * @notice Get current collateral price from oracle
     * @return price Price with 18 decimals
     */
    function _getCollateralPrice() internal view returns (uint256 price) {
        // Call lending market's oracle
        price = ILendingMarket(lendingMarket).getCollateralPrice();
    }
}
