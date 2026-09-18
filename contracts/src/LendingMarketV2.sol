// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/adapters/IAssetAdapter.sol";
import "./interfaces/adapters/IOracleAdapter.sol";
import "./interfaces/adapters/IComplianceAdapter.sol";
import "./interfaces/adapters/ILiquidationAdapter.sol";
import "./interfaces/adapters/IPositionAdapter.sol";

/**
 * @title LPToken
 * @notice ERC20 token representing liquidity provider shares
 */
contract LPTokenV2 is ERC20 {
    address public immutable market;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        market = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == market, "Only market");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == market, "Only market");
        _burn(from, amount);
    }
}

/**
 * @title LendingMarketV2
 * @notice Adapter-based isolated lending market â€” the core engine
 * @dev Delegates all asset-specific logic to pluggable adapters.
 *      The engine knows exactly four verbs: escrow, price, check eligibility, liquidate.
 *
 * What stays in the core engine, non-negotiably:
 * - Circuit breaker logic
 * - Gradual liquidation shape (recoveredForLP + returnedToHolder)
 * - Reentrancy protection and CEI ordering
 * - Defensive verification of adapter outputs
 * - The loan state machine
 *
 * What's pluggable per market:
 * - How collateral is held/released (IAssetAdapter)
 * - Where price comes from (IOracleAdapter)
 * - Who's eligible (IComplianceAdapter â€” optional)
 * - How liquidation executes (ILiquidationAdapter)
 * - How positions are represented (IPositionAdapter)
 */
contract LendingMarketV2 is Initializable, ReentrancyGuard, Pausable, IERC721Receiver {
    using SafeERC20 for IERC20;
    using Address for address;

    // ============ Constants ============

    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant ORIGINATION_FEE_BPS = 50; // 0.5%
    uint256 private constant REVENUE_SHARE_PROTOCOL_BPS = 1000; // 10%
    uint256 private constant MAX_SANE_PRICE = 1e36; // $1T with 18 decimals
    uint256 private constant INITIAL_SHARES_PER_TOKEN = 1e18;

    // ============ Enums ============

    enum MarketStatus {
        ACTIVE,
        PAUSED_VOLATILITY,
        PAUSED_STALE_ORACLE,
        PAUSED_MANUAL
    }

    enum LoanStatus {
        ACTIVE,
        GRACE_PERIOD,
        LIQUIDATION_CURE,       // reversible: holder can still repay
        LIQUIDATION_SETTLING,   // irreversible: async redemption submitted
        REPAID,
        LIQUIDATED
    }

    // ============ Structs ============

    struct Loan {
        uint256 collateralAmount;
        uint256 principal;
        uint256 startTime;
        uint256 expiryTime;
        uint256 frozenInterestAt; // set when entering LIQUIDATION_CURE; 0 otherwise
        LoanStatus status;
    }

    struct CircuitBreakerConfig {
        bool enabled;
        uint256 pauseThresholdBps;    // price move % to trigger pause (in bps)
        uint256 lookbackPeriodSeconds; // how far back to look for volatility
        uint256 resumeThresholdBps;   // price move % to allow resume
        uint256 cooldownSeconds;      // minimum pause duration
    }

    struct ConstructorParams {
        address factory;
        address marketOwner;
        address collateralAsset;
        address lendingAsset;
        address protocolTreasury;
        address assetAdapter;
        address oracleAdapter;
        address complianceAdapter;
        address liquidationAdapter;
        address positionAdapter;
        uint256 ltvBps;
        uint256 aprBps;
        uint256 durationSeconds;
        uint256 gracePeriodHours;
        bool enableHealthFactor;
        uint256 healthFactorThreshold;
        CircuitBreakerConfig cbConfig;
    }

    // ============ Immutable Configuration ============

    address public factory;
    address public marketOwner;
    address public collateralAsset;
    IERC20 public lendingAsset; // stablecoin only
    address public protocolTreasury;
    uint8 public collateralDecimals;
    uint8 public lendingDecimals;
    LPTokenV2 public lpToken;

    // The five adapters â€” the core of the V2 architecture
    IAssetAdapter public assetAdapter;
    IOracleAdapter public oracleAdapter;
    IComplianceAdapter public complianceAdapter; // may be address(0)
    ILiquidationAdapter public liquidationAdapter;
    IPositionAdapter public positionAdapter;

    uint256 public ltvBps;
    uint256 public aprBps;
    uint256 public durationSeconds;
    uint256 public gracePeriodHours;
    bool public enableHealthFactor;
    uint256 public healthFactorThreshold;

    // Collateral standard detected at initialization (review C4): ERC20 collateral
    // is a divisible quantity; ERC721 collateral is one token whose id is stored
    // in Loan.collateralAmount. Drives the escrow invariant and valuation.
    bool public collateralIsERC20;

    // Circuit breaker config (stored, not immutable, because it's a struct)
    CircuitBreakerConfig public cbConfig;

    // ============ Mutable State ============

    uint256 public totalLiquidity;
    uint256 public availableLiquidity;
    uint256 public totalBorrowed;

    MarketStatus public status;
    uint256 public pausedAt;

    // Loan registry
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId;

    // Price history for circuit breaker (last 2 entries for volatility check)
    uint256 public lastPrice;
    uint256 public lastPriceTimestamp;

    // ============ Events ============

    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principal,
        uint256 collateralAmount
    );

    event LoanRepaid(
        uint256 indexed loanId,
        address indexed repayer,
        uint256 principal,
        uint256 interest
    );

    event LoanLiquidated(
        uint256 indexed loanId,
        address indexed liquidator,
        uint256 recoveredForLP,
        uint256 returnedToHolder
    );

    event LiquidationCureStarted(
        uint256 indexed loanId,
        uint256 cureDeadline,
        uint256 frozenDebt
    );

    event LiquidationSettlingStarted(
        uint256 indexed loanId
    );

    event LiquidityDeposited(address indexed provider, uint256 amount, uint256 shares);
    event LiquidityWithdrawn(address indexed provider, uint256 amount, uint256 shares);
    event CircuitBreakerTriggered(string reason, uint256 timestamp);
    event MarketResumed(uint256 timestamp);
    // Review M9: manual pause previously left no trail (CB auto-pauses emit,
    // manual pauses were silent) â€” monitoring needs both
    event MarketPaused(uint256 timestamp);

    // ============ Errors ============

    error MarketNotActive();
    error CircuitBreakerActive();
    error OracleUntrusted();
    error OraclePriceOutOfBounds();
    error InvalidLoanSize();
    error InsufficientLiquidity();
    error LoanNotActive();
    error LoanNotRepaid();
    error LoanAlreadyRepaid();
    error LoanAlreadyLiquidated();
    error NotBorrower();
    error NotLiquidatable();
    error NotOwner();
    error InvalidAmount();
    error GracePeriodNotExpired();
    error CureWindowStillOpen();
    error LoanNotInCure();
    error LoanNotSettling();
    error AdapterUnderDelivered();
    error AdapterAccountingMismatch();
    error SettlementNotClaimed();
    error AlreadyInitialized();
    error InsufficientAvailableLiquidity();
    error ReservedForSettling();
    error EscrowUnderDelivery();
    error ExceedsTotalDebt();
    error RepayBelowAccruedInterest();
    error OutOfBounds();
    error InvalidRange();

    // ============ Constructor / Initializer ============

    constructor() {
        _disableInitializers();
    }

    function initialize(ConstructorParams memory p) external initializer {
        // Review M3/M4: fail-closed parameter validation lives in MarketDeployer.deploy
        // (kept out of the template to stay under the 24KB deploy limit â€” every market
        // clone is created through the deployer, so the check cannot be bypassed).
        factory = p.factory;
        marketOwner = p.marketOwner;
        collateralAsset = p.collateralAsset;
        lendingAsset = IERC20(p.lendingAsset);
        protocolTreasury = p.protocolTreasury;
        collateralDecimals = _readDecimals(p.collateralAsset, 18);
        lendingDecimals = _readDecimals(p.lendingAsset, 18);

        assetAdapter = IAssetAdapter(p.assetAdapter);
        oracleAdapter = IOracleAdapter(p.oracleAdapter);
        complianceAdapter = IComplianceAdapter(p.complianceAdapter);
        liquidationAdapter = ILiquidationAdapter(p.liquidationAdapter);
        positionAdapter = IPositionAdapter(p.positionAdapter);

        ltvBps = p.ltvBps;
        aprBps = p.aprBps;
        durationSeconds = p.durationSeconds;
        gracePeriodHours = p.gracePeriodHours;
        enableHealthFactor = p.enableHealthFactor;
        healthFactorThreshold = p.healthFactorThreshold;
        cbConfig = p.cbConfig;

        lpToken = new LPTokenV2(
            string(abi.encodePacked("OpenAsset Market LP - ", p.collateralAsset)),
            string(abi.encodePacked("oALP-", p.collateralAsset))
        );

        // Approve the asset adapter to move collateral from this market, with
        // standard detection (review C4): ERC20 collateral gets an unlimited ERC20
        // approval; ERC721 collateral gets setApprovalForAll â€” both are what
        // release() needs. The ERC20 `approve(address,uint256)` selector also exists
        // on ERC721 with token-ID semantics, so probing totalSupply() first avoids
        // approving garbage on NFTs. The detected standard is stored and drives the
        // escrow invariant and collateral valuation.
        if (p.collateralAsset.isContract()) {
            bool isErc20;
            try IERC20(p.collateralAsset).totalSupply() returns (uint256) {
                isErc20 = true;
            } catch {
                isErc20 = false;
            }
            collateralIsERC20 = isErc20;
            if (isErc20) {
                IERC20(p.collateralAsset).safeApprove(p.assetAdapter, type(uint256).max);
            } else {
                try IERC721(p.collateralAsset).setApprovalForAll(p.assetAdapter, true) {
                    // ERC721 collateral: adapter may release on repay / hand off on liquidation
                } catch {
                    // Neither standard detected: leave unapproved; escrow fails loudly.
                }
            }
        }

        status = MarketStatus.ACTIVE;
    }

    // ============ Modifiers ============

    modifier onlyMarketOwner() {
        if (msg.sender != marketOwner) revert NotOwner();
        _;
    }

    modifier marketActive() {
        _checkCircuitBreaker();
        if (status != MarketStatus.ACTIVE) revert MarketNotActive();
        _;
    }

    // ============ Liquidity Management ============

    /**
     * @notice Initialize market liquidity (called by factory during deployment)
     * @dev Sets liquidity state without transferring tokens (tokens already transferred by factory)
     * @param amount Amount of lending asset already deposited
     * @param recipient Address to mint LP shares to
     */
    function initializeLiquidity(uint256 amount, address recipient) external {
        if (msg.sender != factory) revert NotOwner();
        if (totalLiquidity != 0) revert AlreadyInitialized();

        totalLiquidity = amount;
        availableLiquidity = amount;

        uint256 shares = amount * INITIAL_SHARES_PER_TOKEN;
        lpToken.mint(recipient, shares);

        emit LiquidityDeposited(recipient, amount, shares);
    }

    /**
     * @notice Deposit liquidity and receive LP shares
     * @param amount Amount of lending asset to deposit
     * @return shares LP shares minted
     */
    function depositLiquidity(uint256 amount) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert InvalidAmount();

        shares = _calculateShares(amount);
        totalLiquidity += amount;
        availableLiquidity += amount;

        lpToken.mint(msg.sender, shares);
        lendingAsset.safeTransferFrom(msg.sender, address(this), amount);

        emit LiquidityDeposited(msg.sender, amount, shares);
    }

    // M1 design note: recovery for an async loan is measured against this
    // settle-time lending-asset snapshot (set in settleLiquidation, consumed and
    // cleared in finalizeRedemptionSettlement).
    mapping(uint256 => uint256) public settleBalance;

    // Review M2: O(1) settling-loan reserve. The previous implementation scanned up
    // to 500 recent loans per withdrawal (~1M gas) and silently under-counted older
    // settling loans â€” enabling pre-write-off exits. The reserve is now maintained
    // exactly at state-transition time (CURE repay clears the loan without reserve;
    // SETTLING entry adds; finalize subtracts), covering ALL loans regardless of
    // book size.
    uint256 public reservedSettling;

    /// @notice Liquidity reserved for async-settling loans (principal at risk of write-off)
    /// @dev Maintained incrementally: settleLiquidation adds, finalize subtracts.
    ///      CURE loans are not reserved until they enter SETTLING — a repaid CURE loan
    ///      never reserves anything, so no decrement path is needed on the repay curve.

    /**
     * @notice Withdraw liquidity by burning LP shares
     * @param shares Number of LP shares to burn
     * @return amount Amount of lending asset returned
     */
    function withdrawLiquidity(uint256 shares) external nonReentrant returns (uint256 amount) {
        if (shares == 0) revert InvalidAmount();

        amount = _calculateAmount(shares);
        if (amount > availableLiquidity) revert InsufficientAvailableLiquidity();

        // Enterprise guard (M2): settlement reserve is enforced exactly â€” withdrawals
        // cannot leave less than the reserved principal available for async write-offs.
        if (reservedSettling > 0) {
            if (availableLiquidity < amount + reservedSettling) revert ReservedForSettling();
        }

        totalLiquidity -= amount;
        availableLiquidity -= amount;

        lpToken.burn(msg.sender, shares);
        lendingAsset.safeTransfer(msg.sender, amount);

        emit LiquidityWithdrawn(msg.sender, amount, shares);
    }

    // ============ Loan Lifecycle ============

    /**
     * @notice Request the maximum available loan against collateral.
     * @dev Kept for backwards compatibility. New clients should use the
     *      selected-principal overload.
     */
    function requestLoan(uint256 collateralAmount)
        external
        marketActive
        nonReentrant
        returns (uint256 loanId)
    {
        return _requestLoan(collateralAmount, 0);
    }

    /**
     * @notice Request a loan against collateral with a bounded USDC principal.
     * @param collateralAmount Amount of collateral to deposit
     * @param requestedPrincipal Desired lending-asset principal; zero means max
     */
    function requestLoan(uint256 collateralAmount, uint256 requestedPrincipal)
        external
        marketActive
        nonReentrant
        returns (uint256 loanId)
    {
        return _requestLoan(collateralAmount, requestedPrincipal);
    }

    function _requestLoan(uint256 collateralAmount, uint256 requestedPrincipal)
        internal
        returns (uint256 loanId)
    {
        // 1. Compliance check (fail-closed)
        if (address(complianceAdapter) != address(0)) {
            try complianceAdapter.isEligible(msg.sender) returns (bool eligible) {
                if (!eligible) revert NotBorrower();
            } catch {
                revert NotBorrower(); // fail-closed
            }
        }

        // 2. Transfer check via asset adapter
        if (!assetAdapter.isTransferable(msg.sender, address(this), collateralAmount)) {
            revert InvalidAmount();
        }

        // 3. Oracle price check
        (uint256 price, bool trusted, ) = oracleAdapter.getPrice();
        if (!trusted) revert OracleUntrusted();
        if (price == 0 || price > MAX_SANE_PRICE) revert OraclePriceOutOfBounds();

        // 4. Calculate and bound the requested principal
        uint256 collateralValue = _collateralValueInLendingUnits(collateralAmount, price);
        uint256 maxLoan = (collateralValue * ltvBps) / BPS_DENOMINATOR;
        if (maxLoan == 0) revert InvalidLoanSize();
        uint256 principal = requestedPrincipal == 0 ? maxLoan : requestedPrincipal;
        if (principal == 0 || principal > maxLoan) revert InvalidLoanSize();
        if (principal > availableLiquidity) revert InsufficientLiquidity();

        // 5. Escrow collateral via asset adapter, with a standard-aware delivery
        // invariant (review C4). For ERC20 collateral, `amountOrId` is a quantity
        // and delivery is verified by balance delta. For ERC721 collateral,
        // `amountOrId` is the tokenId and delivery means the market owns it.
        if (collateralIsERC20) {
            uint256 balanceBefore = IERC20(collateralAsset).balanceOf(address(this));
            assetAdapter.escrow(msg.sender, collateralAmount);
            uint256 balanceAfter = IERC20(collateralAsset).balanceOf(address(this));

            // Defensive invariant: verify adapter delivered the actual collateral amount
            if (balanceAfter < balanceBefore + collateralAmount) revert EscrowUnderDelivery();
        } else {
            assetAdapter.escrow(msg.sender, collateralAmount);
            // Defensive invariant: the market now owns exactly the escrowed NFT
            if (IERC721(collateralAsset).ownerOf(collateralAmount) != address(this)) revert EscrowUnderDelivery();
        }

        // 6. Create loan
        loanId = nextLoanId++;
        loans[loanId] = Loan({
            collateralAmount: collateralAmount,
            principal: principal,
            startTime: block.timestamp,
            expiryTime: block.timestamp + durationSeconds,
            frozenInterestAt: 0,
            status: LoanStatus.ACTIVE
        });

        // 7. Mint position token
        positionAdapter.mint(msg.sender, loanId);

        // 8. Transfer selected funds to borrower
        availableLiquidity -= principal;
        totalBorrowed += principal;
        lendingAsset.safeTransfer(msg.sender, principal);

        emit LoanCreated(loanId, msg.sender, principal, collateralAmount);
    }

    /**
     * @notice Repay a loan and receive collateral back
     * @param loanId The loan to repay
     */
    function repay(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status == LoanStatus.REPAID) revert LoanAlreadyRepaid();
        if (loan.status == LoanStatus.LIQUIDATED) revert LoanAlreadyLiquidated();
        if (loan.status != LoanStatus.ACTIVE && loan.status != LoanStatus.GRACE_PERIOD && loan.status != LoanStatus.LIQUIDATION_CURE) {
            revert LoanNotActive();
        }

        // Calculate total debt
        uint256 interest = _calculateInterest(loan);
        uint256 totalDebt = loan.principal + interest;

        // If in LIQUIDATION_CURE, charge penalty even on repayment (genuine default occurred)
        if (loan.status == LoanStatus.LIQUIDATION_CURE) {
            uint256 penalty = (loan.principal * 500) / BPS_DENOMINATOR; // 5% penalty
            totalDebt += penalty;
        }

        // Transfer debt from repayer
        lendingAsset.safeTransferFrom(msg.sender, address(this), totalDebt);

        // Split INTEREST (and any penalty above principal) only â€” never skim principal
        uint256 revenue = totalDebt - loan.principal;
        uint256 protocolShare = (revenue * REVENUE_SHARE_PROTOCOL_BPS) / BPS_DENOMINATOR;
        uint256 lpRevenue = revenue - protocolShare;

        if (protocolShare > 0) {
            lendingAsset.safeTransfer(protocolTreasury, protocolShare);
        }
        // principal + lpRevenue remain in the pool

        // Release collateral to position holder (whoever currently holds the position)
        address holder = positionAdapter.ownerOf(loanId);
        assetAdapter.release(holder, loan.collateralAmount);

        // Burn position token
        positionAdapter.burn(loanId);

        // Update state
        loan.status = LoanStatus.REPAID;
        totalBorrowed -= loan.principal;
        availableLiquidity += loan.principal + lpRevenue;
        totalLiquidity += lpRevenue;

        emit LoanRepaid(loanId, msg.sender, loan.principal, interest);
    }

    /**
     * @notice Partial repayment â€” reduces outstanding principal after paying the full
     *         accrued interest/penalty first
     * @dev Enterprise feature: allows borrowers to de-risk without closing the position.
     *      - If `repayAmount >= totalDebt`, is equivalent to `repay` (full close).
     *      - Partial repayments MUST cover the entire accrued revenue (interest +
     *        CURE penalty) before any principal is reduced â€” otherwise accrued
     *        interest could be wiped by repeated dust payments (pre-mainnet review C2)
     *        and frozen interest would be double-charged (C3).
     *      - Collateral remains escrowed; position not burned until full repayment.
     *      - Emits LoanRepaid with interest portion for indexing; collateral not released.
     * @param loanId The loan to partially repay
     * @param repayAmount Amount of lending asset to repay (must be >0 and <= totalDebt)
     */
    function repayPartial(uint256 loanId, uint256 repayAmount) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status == LoanStatus.REPAID) revert LoanAlreadyRepaid();
        if (loan.status == LoanStatus.LIQUIDATED) revert LoanAlreadyLiquidated();
        if (loan.status == LoanStatus.LIQUIDATION_SETTLING) revert LoanNotActive();
        if (repayAmount == 0) revert InvalidAmount();

        uint256 interest = _calculateInterest(loan);
        uint256 totalDebt = loan.principal + interest;
        uint256 penalty = 0;
        if (loan.status == LoanStatus.LIQUIDATION_CURE) {
            penalty = (loan.principal * 500) / BPS_DENOMINATOR;
            totalDebt += penalty;
        }
        if (repayAmount > totalDebt) revert ExceedsTotalDebt();

        // If repaying full debt, delegate to full repay (burn + release)
        if (repayAmount == totalDebt) {
            // Inline full repay to avoid reentrancy via external call
            lendingAsset.safeTransferFrom(msg.sender, address(this), totalDebt);
            uint256 fullRevenue = totalDebt - loan.principal;
            uint256 protocolShare = (fullRevenue * REVENUE_SHARE_PROTOCOL_BPS) / BPS_DENOMINATOR;
            uint256 lpRevenueFull = fullRevenue - protocolShare;
            if (protocolShare > 0) lendingAsset.safeTransfer(protocolTreasury, protocolShare);
            address holderFull = positionAdapter.ownerOf(loanId);
            assetAdapter.release(holderFull, loan.collateralAmount);
            positionAdapter.burn(loanId);
            loan.status = LoanStatus.REPAID;
            totalBorrowed -= loan.principal;
            availableLiquidity += loan.principal + lpRevenueFull;
            totalLiquidity += lpRevenueFull;
            emit LoanRepaid(loanId, msg.sender, loan.principal, interest);
            return;
        }

        uint256 revenue = totalDebt - loan.principal; // interest + penalty

        // Review C2/C3 fix: the payment must settle the full accrued revenue before
        // any principal reduction. Previously a dust payment was accepted as partial
        // revenue while `startTime` was reset â€” permanently erasing the unpaid
        // accrued interest (LP revenue theft). Requiring full coverage first also
        // removes the CURE double-charge path.
        if (repayAmount < revenue) revert RepayBelowAccruedInterest();

        // Partial: transfer repayAmount first
        lendingAsset.safeTransferFrom(msg.sender, address(this), repayAmount);

        // Full revenue is paid; remainder reduces principal
        uint256 principalPaid = repayAmount - revenue;

        uint256 protocolSharePartial = (revenue * REVENUE_SHARE_PROTOCOL_BPS) / BPS_DENOMINATOR;
        uint256 lpRevenuePartial = revenue - protocolSharePartial;

        if (protocolSharePartial > 0) {
            lendingAsset.safeTransfer(protocolTreasury, protocolSharePartial);
        }
        // principalPaid + lpRevenuePartial remain in pool as available liquidity
        // Update loan principal and accounting
        // For interest accounting, we reset startTime so future interest accrues on reduced principal
        // Preserve elapsed but rebase: set startTime = now, and treat reduced principal as new baseline.
        // We do this by adjusting totalBorrowed and loan.principal, and resetting frozen state.

        // Reduce principal
        loan.principal -= principalPaid;
        totalBorrowed -= principalPaid;
        availableLiquidity += principalPaid + lpRevenuePartial;
        totalLiquidity += lpRevenuePartial;

        // Rebase interest: the full accrued revenue has been paid, so the clock
        // restarts cleanly on the reduced principal.
        if (loan.status == LoanStatus.LIQUIDATION_CURE) {
            // Re-freeze on the remaining principal: startTime = frozenInterestAt = now
            // means the frozen elapsed window is empty again â€” the remaining cure debt
            // is principal + fresh 5% penalty, with no double-charged frozen interest.
            loan.startTime = block.timestamp;
            loan.frozenInterestAt = block.timestamp;
        } else {
            loan.startTime = block.timestamp;
        }

        // repayAmount < totalDebt implies principalPaid < principal, so the loan
        // cannot reach zero principal here â€” the full-repay branch above is the
        // only close-out path.

        emit LoanRepaid(loanId, msg.sender, principalPaid, revenue);
    }

    /**
     * @notice Liquidate a defaulted loan
     * @param loanId The loan to liquidate
     */
    function liquidate(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status == LoanStatus.REPAID) revert LoanAlreadyRepaid();
        if (loan.status == LoanStatus.LIQUIDATED) revert LoanAlreadyLiquidated();
        if (loan.status == LoanStatus.LIQUIDATION_SETTLING) revert LoanNotInCure();

        // Check liquidation eligibility
        if (loan.status == LoanStatus.LIQUIDATION_CURE) {
            // Cannot liquidate while in cure window â€” must wait for settleLiquidation
            revert LoanNotInCure();
        }
        if (loan.status == LoanStatus.ACTIVE || loan.status == LoanStatus.GRACE_PERIOD) {
            bool expired = block.timestamp > loan.expiryTime;
            (uint256 healthFactor, bool oracleTrusted) = _getHealthFactorWithTrust(loan);
            // An unavailable oracle must not turn the health factor into zero. It may
            // pause origination, but only an explicit expiry or a trusted price breach
            // can start liquidation.
            bool healthFactorBreached = enableHealthFactor && oracleTrusted && healthFactor < healthFactorThreshold;
            if (!expired && !healthFactorBreached) revert NotLiquidatable();
        }

        // Calculate debt owed
        uint256 interest = _calculateInterest(loan);
        uint256 totalDebt = loan.principal + interest;
        uint256 penalty = (loan.principal * 500) / BPS_DENOMINATOR; // 5% penalty
        uint256 debtOwed = totalDebt + penalty;

        // Check if async liquidation
        if (liquidationAdapter.isAsynchronous()) {
            // Enter LIQUIDATION_CURE state
            loan.status = LoanStatus.LIQUIDATION_CURE;
            loan.frozenInterestAt = block.timestamp; // freeze interest

            uint256 cureDeadline = block.timestamp + liquidationAdapter.cureWindowSeconds();

            emit LiquidationCureStarted(loanId, cureDeadline, debtOwed);
            return;
        }

        // Synchronous liquidation. Only adapters that explicitly consume collateral
        // receive it here; failed swaps revert the entire transaction atomically.
        if (liquidationAdapter.requiresCollateralHandoff()) {
            assetAdapter.release(address(liquidationAdapter), loan.collateralAmount);
        }
        uint256 balanceBefore = lendingAsset.balanceOf(address(this));
        (uint256 recoveredForLP, uint256 returnedToHolder) = liquidationAdapter.liquidate(loanId, debtOwed);
        uint256 balanceAfter = lendingAsset.balanceOf(address(this));

        // Enterprise verification: adapter's claimed recoveredForLP must exactly match
        // the lending-asset balance delta observed by the engine. Shortfall reverts;
        // surplus is treated as actual (adapter may have rounded down).
        uint256 actualRecovery = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : 0;
        if (recoveredForLP != actualRecovery) revert AdapterUnderDelivered();
        // returnedToHolder is transferred directly to the holder by the adapter (not to
        // this contract), so it cannot be verified via this contract's balance. It is
        // emitted for off-chain indexing and verified by the adapter's own tests;
        // the engine ensures returnedToHolder was not funded from this contract's liquidity.
        uint256 effectiveRecovery = actualRecovery;

        // Update state
        loan.status = LoanStatus.LIQUIDATED;
        totalBorrowed -= loan.principal;
        availableLiquidity += effectiveRecovery;
        if (loan.principal > effectiveRecovery) {
            totalLiquidity -= (loan.principal - effectiveRecovery);
        }

        // Burn position
        positionAdapter.burn(loanId);

        emit LoanLiquidated(loanId, msg.sender, effectiveRecovery, returnedToHolder);
    }

    /**
     * @notice Complete async liquidation after cure window expires â€” submits redemption
     * @dev Transitions CURE â†’ SETTLING and invokes the async adapter. Accounting is
     *      deferred until `finalizeRedemptionSettlement` is called after the issuer
     *      confirms settlement. This prevents premature loss recognition.
     * @param loanId The loan to settle
     */
    function settleLiquidation(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.LIQUIDATION_CURE) revert LoanNotInCure();

        // Cure window must have expired
        uint256 cureDeadline = loan.frozenInterestAt + liquidationAdapter.cureWindowSeconds();
        if (block.timestamp < cureDeadline) revert CureWindowStillOpen();
        if (!liquidationAdapter.isAsynchronous()) revert LoanNotInCure();

        // Enter irreversible settling state â€” do NOT mark liquidated yet
        loan.status = LoanStatus.LIQUIDATION_SETTLING;
        // Review M2: reserve the full principal at risk of write-off (O(1)).
        // Released at finalizeRedemptionSettlement; CURE repayments never reserve.
        reservedSettling += loan.principal;
        emit LiquidationSettlingStarted(loanId);

        // Submit redemption; async adapters MUST return (0,0) and transfer no lending asset yet
        uint256 interest = _calculateInterest(loan);
        uint256 totalDebt = loan.principal + interest;
        uint256 penalty = (loan.principal * 500) / BPS_DENOMINATOR;
        uint256 debtOwed = totalDebt + penalty;

        if (liquidationAdapter.requiresCollateralHandoff()) {
            assetAdapter.release(address(liquidationAdapter), loan.collateralAmount);
        }
        uint256 balanceBefore = lendingAsset.balanceOf(address(this));
        (uint256 recoveredForLP, uint256 returnedToHolder) = liquidationAdapter.liquidate(loanId, debtOwed);
        uint256 balanceAfter = lendingAsset.balanceOf(address(this));

        // Async submission must not have moved lending asset; verify isolation
        if (balanceAfter != balanceBefore) revert AdapterAccountingMismatch();
        if (recoveredForLP != 0 || returnedToHolder != 0) revert AdapterAccountingMismatch();
        // M1 design note: recovery is measured against this settle-time snapshot at
        // finalize. Sale proceeds that land between settle and finalize (e.g. an
        // on-chain auction buy) are genuine recovery; a snapshot â€” not a spontaneous
        // delta â€” is what makes that measurement correct.
        settleBalance[loanId] = balanceAfter;
        // Loan remains in SETTLING until finalizeRedemptionSettlement
    }

    /**
     * @notice Finalize async redemption after issuer settlement â€” permissionless
     * @dev Must be called after the issuer's `checkSettlement(redemptionId)` returns settled.
     *      The issuer is expected to have transferred `proceeds` of lending asset to this market
     *      (either via direct transfer or via the adapter). Accounting is finalized here with
     *      the same balance-delta verification as sync liquidation.
     * @param loanId The loan in SETTLING state to finalize
     */
    function finalizeRedemptionSettlement(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.LIQUIDATION_SETTLING) revert LoanNotSettling();

        // Verify the adapter acknowledges settlement (review M1 â€” fail-closed).
        // Previously a tolerated call-failure let ANYONE force early finalization
        // with a bare lending-asset donation (loss recognized as a write-off on
        // phantom recovery). All async adapters must implement claimSettlement:
        // it reverts unless settlement genuinely completed.
        // NOTE: `balanceBefore` below is only the call-time reference; recovery is
        // measured against the settle-time snapshot (settleBalance) â€” see below.
        uint256 balanceBefore = lendingAsset.balanceOf(address(this));
        // The adapter is responsible for pulling proceeds from the issuer into this contract
        // during this call. We use a low-level call so adapters revert cleanly when not settled.
        (bool ok, bytes memory data) = address(liquidationAdapter).call(
            abi.encodeWithSignature("claimSettlement(uint256)", loanId)
        );
        if (!ok) revert SettlementNotClaimed();
        uint256 claimedRecovered = 0;
        uint256 claimedReturned = 0;
        if (data.length >= 64) {
            (claimedRecovered, claimedReturned) = abi.decode(data, (uint256, uint256));
        }
        uint256 balanceNow = lendingAsset.balanceOf(address(this));
        uint256 settledAt = settleBalance[loanId];
        uint256 actualRecovery = balanceNow > settledAt ? balanceNow - settledAt : 0;

        // Explicit non-zero claims must match the measured delta; (0, 0) means the
        // adapter's proceeds already landed atomically during buy()/fulfillment â€”
        // finalize on the delta.
        if (claimedRecovered != 0 && claimedRecovered != actualRecovery) {
            revert AdapterAccountingMismatch();
        }
        // claimedReturned is surplus already sent to holder; not verified via market balance

        // If no proceeds yet, keep in SETTLING (front-end will poll)
        if (actualRecovery == 0) revert AdapterUnderDelivered();

        loan.status = LoanStatus.LIQUIDATED;
        delete settleBalance[loanId];
        totalBorrowed -= loan.principal;
        availableLiquidity += actualRecovery;
        if (loan.principal > actualRecovery) {
            totalLiquidity -= (loan.principal - actualRecovery);
        }
        // Review M2: release the settlement reserve now that the write-off is recognized.
        if (reservedSettling >= loan.principal) {
            unchecked {
                reservedSettling -= loan.principal;
            }
        }
        positionAdapter.burn(loanId);
        emit LoanLiquidated(loanId, msg.sender, actualRecovery, claimedReturned);
    }

    // ============ Circuit Breaker ============

    function _checkCircuitBreaker() internal {
        if (!cbConfig.enabled) return;

        (uint256 currentPrice, bool trusted, ) = oracleAdapter.getPrice();

        // Untrusted oracle â†’ pause
        if (!trusted) {
            if (status == MarketStatus.ACTIVE) {
                status = MarketStatus.PAUSED_STALE_ORACLE;
                pausedAt = block.timestamp;
                emit CircuitBreakerTriggered("stale_or_untrusted_oracle", block.timestamp);
            }
            return;
        }

        // Volatility check
        if (lastPrice > 0 && lastPriceTimestamp > 0) {
            uint256 timeDelta = block.timestamp - lastPriceTimestamp;
            if (timeDelta > 0 && timeDelta <= cbConfig.lookbackPeriodSeconds) {
                uint256 priceChange = currentPrice > lastPrice
                    ? ((currentPrice - lastPrice) * BPS_DENOMINATOR) / lastPrice
                    : ((lastPrice - currentPrice) * BPS_DENOMINATOR) / lastPrice;

                if (priceChange >= cbConfig.pauseThresholdBps && status == MarketStatus.ACTIVE) {
                    status = MarketStatus.PAUSED_VOLATILITY;
                    pausedAt = block.timestamp;
                    emit CircuitBreakerTriggered("volatility", block.timestamp);
                    return;
                }
            }
        }

        // Resume check
        if (status == MarketStatus.PAUSED_VOLATILITY || status == MarketStatus.PAUSED_STALE_ORACLE) {
            bool cooldownPassed = block.timestamp >= pausedAt + cbConfig.cooldownSeconds;
            uint256 resumeChange = lastPrice > 0
                ? (currentPrice > lastPrice
                    ? ((currentPrice - lastPrice) * BPS_DENOMINATOR) / lastPrice
                    : ((lastPrice - currentPrice) * BPS_DENOMINATOR) / lastPrice)
                : 0;

            bool conditionsNormal = trusted && resumeChange < cbConfig.resumeThresholdBps;
            if (cooldownPassed && conditionsNormal) {
                status = MarketStatus.ACTIVE;
                emit MarketResumed(block.timestamp);
            }
        }

        // Update price history (only when active, to preserve baseline for resume check)
        if (status == MarketStatus.ACTIVE) {
            lastPrice = currentPrice;
            lastPriceTimestamp = block.timestamp;
        }
    }

    // ============ Admin Functions ============

    function pause() external onlyMarketOwner {
        status = MarketStatus.PAUSED_MANUAL;
        pausedAt = block.timestamp;
        emit MarketPaused(block.timestamp);
    }

    function unpause() external onlyMarketOwner {
        if (status == MarketStatus.PAUSED_MANUAL) {
            status = MarketStatus.ACTIVE;
            emit MarketResumed(block.timestamp);
        }
    }

    // ============ ERC721 Receiver ============

    /// @notice Allows ERC721 collateral to be safeTransferFrom'd into escrow
    ///         (asset adapters use safeTransferFrom; without the hook every NFT
    ///         escrow reverts). Also accepts direct NFT transfers â€” such tokens
    ///         join the market's collateral custody unaccounted (LP-beneficial
    ///         donation; no accounting impact).
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ============ View Functions ============

    function getHealthFactor(uint256 loanId) external view returns (uint256) {
        return _getHealthFactor(loans[loanId]);
    }

    /**
     * @notice Return the minimum lending-asset output accepted for collateral liquidation.
     * @dev The quote is fail-closed when the oracle is untrusted or token decimals cannot
     *      be read. The debt floor prevents a swap from paying less than the loan balance.
     */
    function getLiquidationMinOutput(uint256 collateralAmount, uint256 debtOwed, uint16 slippageBps)
        external view returns (uint256 minOutput, bool oracleTrusted)
    {
        if (debtOwed == 0 || slippageBps > 5000) return (0, false);
        (uint256 price, bool trusted, ) = oracleAdapter.getPrice();
        if (!trusted || price == 0) return (0, false);

        uint256 oracleValueInLoan = _collateralValueInLendingUnits(collateralAmount, price);
        uint256 slippageFloor = Math.mulDiv(oracleValueInLoan, BPS_DENOMINATOR - slippageBps, BPS_DENOMINATOR);
        minOutput = slippageFloor > debtOwed ? slippageFloor : debtOwed;
        oracleTrusted = minOutput > 0;
    }

    function getLoanDetails(uint256 loanId) external view returns (
        uint256 collateralAmount,
        uint256 principal,
        uint256 startTime,
        uint256 expiryTime,
        uint256 frozenInterestAt,
        LoanStatus loanStatus,
        uint256 healthFactor,
        address positionHolder
    ) {
        Loan storage loan = loans[loanId];
        return (
            loan.collateralAmount,
            loan.principal,
            loan.startTime,
            loan.expiryTime,
            loan.frozenInterestAt,
            loan.status,
            _getHealthFactor(loan),
            positionAdapter.ownerOf(loanId)
        );
    }

    // ============ Paginated Views (Enterprise) ============

    /// @notice Legacy view â€” iterates all loans. Gas-unbounded; use getMarketStatsPaginated for >500 loans.
    /// @dev Kept for backward compatibility and off-chain indexers that cache.
    function getMarketStats() external view returns (
        uint256 _totalLiquidity,
        uint256 _availableLiquidity,
        uint256 _totalBorrowed,
        uint256 activeLoans,
        MarketStatus marketStatus
    ) {
        return getMarketStatsPaginated(0, nextLoanId);
    }

    /// @notice Gas-bounded paginated stats. Reverts if range too large (>1000) to protect RPC.
    function getMarketStatsPaginated(uint256 startId, uint256 endId) public view returns (
        uint256 _totalLiquidity,
        uint256 _availableLiquidity,
        uint256 _totalBorrowed,
        uint256 activeLoans,
        MarketStatus marketStatus
    ) {
        if (endId > nextLoanId) revert OutOfBounds();
        if (endId < startId) revert InvalidRange();
        if (endId - startId > 1000) revert InvalidRange();
        uint256 active = 0;
        for (uint256 i = startId; i < endId; i++) {
            LoanStatus s = loans[i].status;
            if (s == LoanStatus.ACTIVE || s == LoanStatus.GRACE_PERIOD || s == LoanStatus.LIQUIDATION_CURE || s == LoanStatus.LIQUIDATION_SETTLING) {
                active++;
            }
        }
        return (totalLiquidity, availableLiquidity, totalBorrowed, active, status);
    }

    /// @notice Total loan count for pagination
    function getLoanCount() external view returns (uint256) {
        return nextLoanId;
    }

    /// @notice Batch loan details for indexer pagination
    function getLoansPaginated(uint256 startId, uint256 endId) external view returns (
        uint256[] memory collateralAmounts,
        uint256[] memory principals,
        uint256[] memory startTimes,
        uint256[] memory expiryTimes,
        LoanStatus[] memory statuses
    ) {
        if (endId > nextLoanId || endId < startId || endId - startId > 200) revert InvalidRange();
        uint256 n = endId - startId;
        collateralAmounts = new uint256[](n);
        principals = new uint256[](n);
        startTimes = new uint256[](n);
        expiryTimes = new uint256[](n);
        statuses = new LoanStatus[](n);
        for (uint256 i = 0; i < n; i++) {
            Loan storage l = loans[startId + i];
            collateralAmounts[i] = l.collateralAmount;
            principals[i] = l.principal;
            startTimes[i] = l.startTime;
            expiryTimes[i] = l.expiryTime;
            statuses[i] = l.status;
        }
    }

    // ============ Internal Functions ============

    function _readDecimals(address token, uint8 fallbackDecimals) internal view returns (uint8) {
        try IERC20Metadata(token).decimals() returns (uint8 value) {
            return value <= 36 ? value : fallbackDecimals;
        } catch {
            return fallbackDecimals;
        }
    }

    function _collateralValueInLendingUnits(uint256 amount, uint256 price18) internal view returns (uint256) {
        uint256 usdValue18;
        if (collateralIsERC20) {
            usdValue18 = Math.mulDiv(amount, price18, 10 ** collateralDecimals);
        } else {
            // ERC721 collateral (review C4): `amount` is the tokenId; each position
            // is exactly ONE token, valued at the oracle's per-collection floor
            // price. Token-id-as-quantity would scale valuation nonsensically.
            usdValue18 = price18;
        }
        return Math.mulDiv(usdValue18, 10 ** lendingDecimals, 1e18);
    }

    function _calculateShares(uint256 amount) internal view returns (uint256) {
        if (totalLiquidity == 0) {
            return amount * INITIAL_SHARES_PER_TOKEN;
        }
        return (amount * lpToken.totalSupply()) / totalLiquidity;
    }

    function _calculateAmount(uint256 shares) internal view returns (uint256) {
        if (lpToken.totalSupply() == 0) return 0;
        return (shares * totalLiquidity) / lpToken.totalSupply();
    }

    function _calculateInterest(Loan storage loan) internal view returns (uint256) {
        if (loan.startTime == 0 || loan.principal == 0) return 0;
        uint256 elapsed;
        if (loan.frozenInterestAt != 0) {
            // Interest frozen at cure entry â€” no further accrual
            elapsed = loan.frozenInterestAt > loan.startTime ? loan.frozenInterestAt - loan.startTime : 0;
        } else {
            elapsed = block.timestamp > loan.startTime ? block.timestamp - loan.startTime : 0;
        }
        if (elapsed == 0) return 0;
        // APR is annualized: interest = principal * aprBps * elapsed / (BPS * 365 days)
        // set at market creation (immutable aprBps). Uses 365-day year for determinism.
        uint256 annualInterest = Math.mulDiv(loan.principal, aprBps, BPS_DENOMINATOR);
        return Math.mulDiv(annualInterest, elapsed, 365 days);
    }

    function _getHealthFactor(Loan storage loan) internal view returns (uint256) {
        (uint256 healthFactor, ) = _getHealthFactorWithTrust(loan);
        return healthFactor;
    }

    function _getHealthFactorWithTrust(Loan storage loan) internal view returns (uint256 healthFactor, bool oracleTrusted) {
        if (!enableHealthFactor) return (type(uint256).max, true);

        (uint256 price, bool trusted, ) = oracleAdapter.getPrice();
        if (!trusted || price == 0) return (0, false);

        uint256 collateralValue = _collateralValueInLendingUnits(loan.collateralAmount, price);
        uint256 totalDebt = loan.principal + _calculateInterest(loan);

        if (totalDebt == 0) return (type(uint256).max, true);
        return ((collateralValue * BPS_DENOMINATOR) / totalDebt, true);
    }
}
