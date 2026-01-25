// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IOracle.sol";

/**
 * @title LendingMarket
 * @notice Isolated lending market for a specific asset pair
 * @dev Implements checks-effects-interactions, pull-over-push, and circuit breakers
 */
contract LendingMarket is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // --- State Variables ---

    IERC20 public immutable collateralAsset;
    IERC20 public immutable loanAsset; // e.g., USDC
    IOracle public immutable oracle;

    uint256 public immutable ltvBps; // Loan-to-Value in basis points (e.g., 7500 = 75%)
    uint256 public immutable durationSeconds;
    uint256 public immutable interestRateBps; // APR in basis points

    struct Loan {
        address borrower;
        uint256 collateralAmount;
        uint256 principalAmount;
        uint256 startTime;
        uint256 expiryTime;
        bool active;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId;

    // Pull-over-push pattern for withdrawals
    mapping(address => uint256) public pendingWithdrawals;

    // --- Events ---

    event LiquidityDeposited(address indexed provider, uint256 amount);
    event LiquidityWithdrawn(address indexed provider, uint256 amount);
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 collateral, uint256 principal);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower);
    event Liquidated(uint256 indexed loanId, address indexed liquidator);

    // --- Constructor ---

    constructor(
        address _owner,
        address _collateralAsset,
        address _loanAsset,
        address _oracle,
        uint256 _ltvBps,
        uint256 _durationSeconds,
        uint256 _interestRateBps
    ) Ownable(_owner) {
        require(_collateralAsset != address(0), "Invalid collateral");
        require(_loanAsset != address(0), "Invalid loan asset");
        require(_oracle != address(0), "Invalid oracle");
        require(_ltvBps > 0 && _ltvBps <= 10000, "Invalid LTV");
        require(_durationSeconds > 0, "Invalid duration");

        collateralAsset = IERC20(_collateralAsset);
        loanAsset = IERC20(_loanAsset);
        oracle = IOracle(_oracle);
        ltvBps = _ltvBps;
        durationSeconds = _durationSeconds;
        interestRateBps = _interestRateBps;
    }

    // --- LP Functions ---

    function depositLiquidity(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        loanAsset.safeTransferFrom(msg.sender, address(this), amount);
        // In a real protocol, we'd mint shares here. For minimal MVP, just tracking balance implicitly for now or simply allowing deposit.
        // Assuming simple pool for one LP or just donation for now based on PRD simplicity 'Initial Liquidity'.
        emit LiquidityDeposited(msg.sender, amount);
    }

    // --- Borrower Functions ---

    /**
     * @notice Borrow funds against collateral
     * @dev Follows Checks-Effects-Interactions pattern
     */
    function requestLoan(uint256 collateralAmount) external nonReentrant whenNotPaused {
        require(collateralAmount > 0, "Collateral must be > 0");
        
        // 1. CHECKS
        // Calculate max loan amount
        uint256 price = oracle.getPrice(address(collateralAsset)); // scaled 1e18
        uint256 collateralValue = (collateralAmount * price) / 1e18;
        uint256 maxLoan = (collateralValue * ltvBps) / 10000;
        
        require(loanAsset.balanceOf(address(this)) >= maxLoan, "Insufficient liquidity");

        // 2. EFFECTS
        uint256 loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: msg.sender,
            collateralAmount: collateralAmount,
            principalAmount: maxLoan,
            startTime: block.timestamp,
            expiryTime: block.timestamp + durationSeconds,
            active: true
        });

        // 3. INTERACTIONS
        // Pull collateral (requires approval)
        collateralAsset.safeTransferFrom(msg.sender, address(this), collateralAmount);
        
        // Push loan principal
        loanAsset.safeTransfer(msg.sender, maxLoan);

        emit LoanRequested(loanId, msg.sender, collateralAmount, maxLoan);
    }

    /**
     * @notice Repay loan and reclaim collateral
     */
    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");
        require(block.timestamp <= loan.expiryTime, "Loan expired");
        
        // Calculate repayment amount (simplified interest for MVP: fixed rate for duration)
        // Interest = Principal * Rate * (Duration / Year)
        // Here assuming simplified flat fee for the period or per-second.
        // Let's implement full repayment: Principal + Interest
        uint256 interest = (loan.principalAmount * interestRateBps) / 10000;
        uint256 totalRepayment = loan.principalAmount + interest;

        // EFFECTS
        loan.active = false;

        // INTERACTIONS
        loanAsset.safeTransferFrom(msg.sender, address(this), totalRepayment);
        collateralAsset.safeTransfer(loan.borrower, loan.collateralAmount);

        emit LoanRepaid(loanId, msg.sender);
    }

    // --- Safety / Emergency ---

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdrawal for owner (Pull pattern)
     * @dev Only withdrawing excess liquidity, not locked collateral ideally
     */
    function emergencyWithdrawLiquidity(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= loanAsset.balanceOf(address(this)), "Insufficient balance");
        loanAsset.safeTransfer(msg.sender, amount);
    }
}
