// SPDX-License-Identifier: MIT
// Flattened for Remix Deployment
// Red Chips LoanContract - Individual Loan Escrow
pragma solidity 0.8.20;

// ============================================================================
// OpenZeppelin Contracts - IERC20
// ============================================================================
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// ============================================================================
// OpenZeppelin Contracts - IERC721
// ============================================================================
interface IERC721 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

// ============================================================================
// OpenZeppelin Contracts - IERC1155
// ============================================================================
interface IERC1155 {
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external;
    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external;
}

// ============================================================================
// OpenZeppelin Contracts - SafeERC20
// ============================================================================
library Address {
    error AddressInsufficientBalance(address account);
    error AddressEmptyCode(address target);
    error FailedInnerCall();

    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) {
            revert AddressInsufficientBalance(address(this));
        }
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert FailedInnerCall();
        }
    }

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) {
            revert AddressInsufficientBalance(address(this));
        }
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function verifyCallResultFromTarget(address target, bool success, bytes memory returndata) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            if (returndata.length == 0 && target.code.length == 0) {
                revert AddressEmptyCode(target);
            }
            return returndata;
        }
    }

    function _revert(bytes memory returndata) private pure {
        if (returndata.length > 0) {
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert FailedInnerCall();
        }
    }
}

library SafeERC20 {
    using Address for address;

    error SafeERC20FailedOperation(address token);
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        bytes memory returndata = address(token).functionCall(data);
        if (returndata.length != 0 && !abi.decode(returndata, (bool))) {
            revert SafeERC20FailedOperation(address(token));
        }
    }
}

// ============================================================================
// OpenZeppelin Contracts - ReentrancyGuard
// ============================================================================
abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = NOT_ENTERED;
    }
}

// ============================================================================
// Enums
// ============================================================================
enum AssetType { ERC20, ERC721, ERC1155 }

// ============================================================================
// AssetHandler Library
// ============================================================================
library AssetHandler {
    using SafeERC20 for IERC20;
    
    enum AssetType { ERC20, ERC721, ERC1155 }
    
    error InvalidAsset();
    error TransferFailed();
    
    function transferAsset(
        AssetType assetType,
        address asset,
        address from,
        address to,
        uint256 amountOrTokenId,
        uint256 erc1155Amount
    ) internal {
        if (assetType == AssetType.ERC20) {
            IERC20(asset).safeTransferFrom(from, to, amountOrTokenId);
        } else if (assetType == AssetType.ERC721) {
            IERC721(asset).safeTransferFrom(from, to, amountOrTokenId);
        } else {
            IERC1155(asset).safeTransferFrom(from, to, amountOrTokenId, erc1155Amount, "");
        }
    }
    
    function transferAssetOut(
        AssetType assetType,
        address asset,
        address to,
        uint256 amountOrTokenId,
        uint256 erc1155Amount
    ) internal {
        if (assetType == AssetType.ERC20) {
            IERC20(asset).safeTransfer(to, amountOrTokenId);
        } else if (assetType == AssetType.ERC721) {
            IERC721(asset).safeTransferFrom(address(this), to, amountOrTokenId);
        } else {
            IERC1155(asset).safeTransferFrom(address(this), to, amountOrTokenId, erc1155Amount, "");
        }
    }
}

// ============================================================================
// ILoanContract Interface
// ============================================================================
interface ILoanContract {
    enum LoanStatus { ACTIVE, REPAID, LIQUIDATED, DEFAULTED }
    
    function initialize(
        address borrower_,
        uint256 collateralAmount_,
        uint256 tokenId_,
        uint256 erc1155Amount_,
        uint256 principal_,
        uint256 interestAmount_,
        uint256 expiryTime_
    ) external;
    
    function repay() external;
    function liquidate() external;
    function getHealthFactor() external view returns (uint256 healthFactor);
    function isLiquidatable() external view returns (bool canLiquidate);
    
    function getLoanDetails() external view returns (
        address borrower,
        uint256 principal,
        uint256 interestAmount,
        uint256 collateralAmount,
        uint256 tokenId,
        uint256 startTime,
        uint256 expiryTime,
        LoanStatus status,
        uint256 healthFactor
    );
}

// ============================================================================
// ILendingMarket Interface (minimal for LoanContract)
// ============================================================================
interface ILendingMarket {
    function removeLoan(address loanContract, uint256 principal) external;
    function getCollateralPrice() external view returns (uint256 price);
    function getLoanConfig() external view returns (
        address collateralAsset,
        address loanAsset,
        address protocolTreasury,
        address oracle,
        AssetType assetType,
        uint256 healthFactorThreshold
    );
}

// ============================================================================
// LoanContract
// ============================================================================

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
 * @custom:security-contact security@redchips.io
 */
contract LoanContract is ILoanContract, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using AssetHandler for AssetHandler.AssetType;
    
    // ============ Constants ============
    
    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant ORIGINATION_FEE_BPS = 50; // 0.5%
    uint256 private constant MIN_HEALTH_FACTOR = 1e18; // 1.0 = 100%
    
    // ============ Storage ============
    
    address public lendingMarket;
    address public borrower;
    address public collateralAsset;
    address public loanAsset;
    address public protocolTreasury;
    address public oracle;
    
    AssetHandler.AssetType public assetType;
    LoanStatus public status;
    
    uint256 public collateralAmount;
    uint256 public tokenId;
    uint256 public erc1155Amount;
    uint256 public principal;
    uint256 public interestAmount;
    uint256 public startTime;
    uint256 public expiryTime;
    uint256 public healthFactorThreshold;
    
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
    
    // ============ Initialization ============
    
    function initialize(
        address borrower_,
        uint256 collateralAmount_,
        uint256 tokenId_,
        uint256 erc1155Amount_,
        uint256 principal_,
        uint256 interestAmount_,
        uint256 expiryTime_
    ) external override {
        if (initialized) revert AlreadyInitialized();
        
        lendingMarket = msg.sender;
        
        (
            collateralAsset,
            loanAsset,
            protocolTreasury,
            oracle,
            AssetType aType,
            healthFactorThreshold
        ) = ILendingMarket(msg.sender).getLoanConfig();
        
        assetType = AssetHandler.AssetType(uint8(aType));
        
        borrower = borrower_;
        collateralAmount = collateralAmount_;
        tokenId = tokenId_;
        erc1155Amount = erc1155Amount_;
        principal = principal_;
        interestAmount = interestAmount_;
        startTime = block.timestamp;
        expiryTime = expiryTime_;
        status = LoanStatus.ACTIVE;
        initialized = true;
        
        emit LoanInitialized(borrower_, principal_, interestAmount_, collateralAmount_, expiryTime_);
    }
    
    // ============ Loan Operations ============
    
    function repay() external override nonReentrant onlyActive {
        uint256 totalRepayment = principal + interestAmount;
        
        if (block.timestamp > expiryTime) revert LoanNotRepayable();
        
        uint256 platformShare = (interestAmount * 1000) / BPS_DENOMINATOR;
        uint256 lpShare = interestAmount - platformShare;
        
        status = LoanStatus.REPAID;
        
        IERC20 loanToken = IERC20(loanAsset);
        loanToken.safeTransferFrom(msg.sender, address(this), totalRepayment);
        
        ILendingMarket(lendingMarket).removeLoan(address(this), principal);
        
        loanToken.safeTransfer(lendingMarket, principal + lpShare);
        loanToken.safeTransfer(protocolTreasury, platformShare);
        
        AssetHandler.transferAssetOut(
            assetType,
            collateralAsset,
            borrower,
            assetType == AssetHandler.AssetType.ERC721 ? tokenId : collateralAmount,
            erc1155Amount
        );
        
        emit LoanRepaid(borrower, totalRepayment, block.timestamp);
    }
    
    function liquidate() external override nonReentrant onlyActive {
        if (!isLiquidatable()) revert LoanNotLiquidatable();
        
        uint256 totalDebt = principal + interestAmount;
        uint256 collateralValue = _getCollateralValue();
        
        status = LoanStatus.LIQUIDATED;
        
        ILendingMarket(lendingMarket).removeLoan(address(this), principal);
        
        if (assetType == AssetHandler.AssetType.ERC20) {
            _liquidateERC20(totalDebt, collateralValue);
        } else if (assetType == AssetHandler.AssetType.ERC721) {
            _liquidateERC721(totalDebt, collateralValue);
        } else {
            _liquidateERC1155(totalDebt, collateralValue);
        }
    }
    
    // ============ Liquidation Implementations ============
    
    function _liquidateERC20(uint256 totalDebt, uint256 collateralValue) internal {
        IERC20 loanToken = IERC20(loanAsset);
        
        if (collateralValue <= totalDebt) {
            uint256 repaymentAmount = collateralValue;
            loanToken.safeTransferFrom(msg.sender, address(this), repaymentAmount);
            
            uint256 platformShare = (interestAmount * 1000) / BPS_DENOMINATOR;
            uint256 lpShare = repaymentAmount - principal - platformShare;
            
            loanToken.safeTransfer(lendingMarket, principal + lpShare);
            loanToken.safeTransfer(protocolTreasury, platformShare);
            
            AssetHandler.transferAssetOut(assetType, collateralAsset, msg.sender, collateralAmount, 0);
            
            emit LoanLiquidated(msg.sender, borrower, collateralAmount, repaymentAmount, block.timestamp);
        } else {
            uint256 collateralPrice = _getCollateralPrice();
            uint256 collateralNeeded = (totalDebt * 1e18) / collateralPrice;
            uint256 penalty = (collateralNeeded * 500) / BPS_DENOMINATOR;
            uint256 totalCollateralSeized = collateralNeeded + penalty;
            
            if (totalCollateralSeized > collateralAmount) {
                totalCollateralSeized = collateralAmount;
            }
            
            uint256 surplus = collateralAmount - totalCollateralSeized;
            
            loanToken.safeTransferFrom(msg.sender, address(this), totalDebt);
            
            uint256 platformShare = (interestAmount * 1000) / BPS_DENOMINATOR;
            uint256 lpShare = interestAmount - platformShare;
            
            loanToken.safeTransfer(lendingMarket, principal + lpShare);
            loanToken.safeTransfer(protocolTreasury, platformShare);
            
            IERC20(collateralAsset).safeTransfer(msg.sender, totalCollateralSeized);
            
            if (surplus > 0) {
                IERC20(collateralAsset).safeTransfer(borrower, surplus);
            }
            
            emit LoanLiquidated(msg.sender, borrower, totalCollateralSeized, totalDebt, block.timestamp);
        }
    }
    
    function _liquidateERC721(uint256 totalDebt, uint256 collateralValue) internal {
        IERC20 loanToken = IERC20(loanAsset);
        
        loanToken.safeTransferFrom(msg.sender, address(this), totalDebt);
        
        uint256 platformShare = (interestAmount * 1000) / BPS_DENOMINATOR;
        uint256 lpShare = interestAmount - platformShare;
        
        loanToken.safeTransfer(lendingMarket, principal + lpShare);
        loanToken.safeTransfer(protocolTreasury, platformShare);
        
        AssetHandler.transferAssetOut(assetType, collateralAsset, msg.sender, tokenId, 0);
        
        emit LoanLiquidated(msg.sender, borrower, 1, totalDebt, block.timestamp);
    }
    
    function _liquidateERC1155(uint256 totalDebt, uint256 collateralValue) internal {
        IERC20 loanToken = IERC20(loanAsset);
        
        if (collateralValue <= totalDebt) {
            uint256 repaymentAmount = collateralValue;
            loanToken.safeTransferFrom(msg.sender, address(this), repaymentAmount);
            
            uint256 platformShare = (interestAmount * 1000) / BPS_DENOMINATOR;
            uint256 remaining = repaymentAmount - principal;
            uint256 lpShare = remaining > platformShare ? remaining - platformShare : 0;
            
            loanToken.safeTransfer(lendingMarket, principal + lpShare);
            if (platformShare > 0) {
                loanToken.safeTransfer(protocolTreasury, platformShare);
            }
            
            AssetHandler.transferAssetOut(assetType, collateralAsset, msg.sender, erc1155Amount, erc1155Amount);
            
            emit LoanLiquidated(msg.sender, borrower, erc1155Amount, repaymentAmount, block.timestamp);
        } else {
            uint256 collateralPrice = _getCollateralPrice();
            uint256 collateralNeeded = (totalDebt * 1e18) / collateralPrice;
            uint256 penalty = (collateralNeeded * 500) / BPS_DENOMINATOR;
            uint256 totalCollateralSeized = collateralNeeded + penalty;
            
            if (totalCollateralSeized > erc1155Amount) {
                totalCollateralSeized = erc1155Amount;
            }
            
            uint256 surplus = erc1155Amount - totalCollateralSeized;
            
            loanToken.safeTransferFrom(msg.sender, address(this), totalDebt);
            
            uint256 platformShare = (interestAmount * 1000) / BPS_DENOMINATOR;
            uint256 lpShare = interestAmount - platformShare;
            
            loanToken.safeTransfer(lendingMarket, principal + lpShare);
            loanToken.safeTransfer(protocolTreasury, platformShare);
            
            AssetHandler.transferAssetOut(assetType, collateralAsset, msg.sender, totalCollateralSeized, totalCollateralSeized);
            
            if (surplus > 0) {
                AssetHandler.transferAssetOut(assetType, collateralAsset, borrower, surplus, surplus);
            }
            
            emit LoanLiquidated(msg.sender, borrower, totalCollateralSeized, totalDebt, block.timestamp);
        }
    }
    
    // ============ View Functions ============
    
    function getHealthFactor() public view override returns (uint256 healthFactor) {
        if (status != LoanStatus.ACTIVE) return 0;
        
        uint256 collateralValue = _getCollateralValue();
        uint256 totalDebt = principal + interestAmount;
        
        if (totalDebt == 0) return type(uint256).max;
        
        healthFactor = (collateralValue * 1e18) / totalDebt;
    }
    
    function isLiquidatable() public view override returns (bool canLiquidate) {
        if (status != LoanStatus.ACTIVE) return false;
        if (block.timestamp > expiryTime) return true;
        
        uint256 healthFactor = getHealthFactor();
        if (healthFactor < healthFactorThreshold) return true;
        
        return false;
    }
    
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
    
    // ============ Internal Functions ============
    
    function _getCollateralValue() internal view returns (uint256 value) {
        uint256 price = _getCollateralPrice();
        
        if (assetType == AssetHandler.AssetType.ERC20) {
            value = (collateralAmount * price) / 1e18;
        } else if (assetType == AssetHandler.AssetType.ERC721) {
            value = price;
        } else {
            value = (erc1155Amount * price) / 1e18;
        }
    }
    
    function _getCollateralPrice() internal view returns (uint256 price) {
        price = ILendingMarket(lendingMarket).getCollateralPrice();
    }
}
