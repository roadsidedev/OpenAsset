// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
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
 * @notice Adapter-based isolated lending market — the core engine
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
 * - Who's eligible (IComplianceAdapter — optional)
 * - How liquidation executes (ILiquidationAdapter)
 * - How positions are represented (IPositionAdapter)
 */
contract LendingMarketV2 is ReentrancyGuard, Pausable {
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

    // ============ Immutable Configuration ============

    address public immutable factory;
    address public immutable marketOwner;
    address public immutable collateralAsset;
    IERC20 public immutable lendingAsset; // stablecoin only
    address public immutable protocolTreasury;
    uint8 public immutable collateralDecimals;
    uint8 public immutable lendingDecimals;
    LPTokenV2 public immutable lpToken;

    // The five adapters — the core of the V2 architecture
    IAssetAdapter public immutable assetAdapter;
    IOracleAdapter public immutable oracleAdapter;
    IComplianceAdapter public immutable complianceAdapter; // may be address(0)
    ILiquidationAdapter public immutable liquidationAdapter;
    IPositionAdapter public immutable positionAdapter;

    uint256 public immutable ltvBps;
    uint256 public immutable aprBps;
    uint256 public immutable durationSeconds;
    uint256 public immutable gracePeriodHours;
    bool public immutable enableHealthFactor;
    uint256 public immutable healthFactorThreshold;

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

    // ============ Constructor ============

    constructor(
        address _factory,
        address _marketOwner,
        address _collateralAsset,
        address _lendingAsset,
        address _protocolTreasury,

        // The five adapters
        address _assetAdapter,
        address _oracleAdapter,
        address _complianceAdapter,
        address _liquidationAdapter,
        address _positionAdapter,

        // Risk parameters
        uint256 _ltvBps,
        uint256 _aprBps,
        uint256 _durationSeconds,
        uint256 _gracePeriodHours,
        bool _enableHealthFactor,
        uint256 _healthFactorThreshold,

        // Circuit breaker
        CircuitBreakerConfig memory _cbConfig
    ) {
        factory = _factory;
        marketOwner = _marketOwner;
        collateralAsset = _collateralAsset;
        lendingAsset = IERC20(_lendingAsset);
        protocolTreasury = _protocolTreasury;
        collateralDecimals = _readDecimals(_collateralAsset, 18);
        lendingDecimals = _readDecimals(_lendingAsset, 18);

        assetAdapter = IAssetAdapter(_assetAdapter);
        oracleAdapter = IOracleAdapter(_oracleAdapter);
        complianceAdapter = IComplianceAdapter(_complianceAdapter);
        liquidationAdapter = ILiquidationAdapter(_liquidationAdapter);
        positionAdapter = IPositionAdapter(_positionAdapter);

        ltvBps = _ltvBps;
        aprBps = _aprBps;
        durationSeconds = _durationSeconds;
        gracePeriodHours = _gracePeriodHours;
        enableHealthFactor = _enableHealthFactor;
        healthFactorThreshold = _healthFactorThreshold;
        cbConfig = _cbConfig;

        lpToken = new LPTokenV2(
            string(abi.encodePacked("OpenAsset Market LP - ", _collateralAsset)),
            string(abi.encodePacked("oALP-", _collateralAsset))
        );

        // Approve the asset adapter to move ERC20 collateral from this market.
        // Guarded by Address.isContract so non-ERC20 collateral (EOA, ERC721, etc.)
        // does not cause the constructor to revert. For ERC721 collateral the
        // adapter-specific approval (setApprovalForAll) is handled by the ERC721Adapter.
        if (_collateralAsset.isContract()) {
            IERC20(_collateralAsset).safeApprove(_assetAdapter, type(uint256).max);
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
        require(msg.sender == factory, "Only factory");
        require(totalLiquidity == 0, "Already initialized");

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

    /**
     * @notice Withdraw liquidity by burning LP shares
     * @param shares Number of LP shares to burn
     * @return amount Amount of lending asset returned
     */
    function withdrawLiquidity(uint256 shares) external nonReentrant returns (uint256 amount) {
        if (shares == 0) revert InvalidAmount();

        amount = _calculateAmount(shares);
        require(amount <= availableLiquidity, "Insufficient available liquidity");

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

        // 5. Escrow collateral via asset adapter
        uint256 balanceBefore = IERC20(collateralAsset).balanceOf(address(this));
        assetAdapter.escrow(msg.sender, collateralAmount);
        uint256 balanceAfter = IERC20(collateralAsset).balanceOf(address(this));

        // Defensive invariant: verify adapter delivered the actual collateral amount
        require(balanceAfter >= balanceBefore + collateralAmount, "Escrow under-delivery");

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

        // Split INTEREST (and any penalty above principal) only — never skim principal
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
            // Cannot liquidate while in cure window — must wait for settleLiquidation
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

        // Verify adapter delivered the claimed amount
        uint256 actualRecovery = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : 0;
        uint256 shortfall = recoveredForLP > actualRecovery ? recoveredForLP - actualRecovery : 0;
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
     * @notice Complete async liquidation after cure window expires
     * @param loanId The loan to settle
     */
    function settleLiquidation(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.LIQUIDATION_CURE) revert LoanNotInCure();

        // Cure window must have expired
        uint256 cureDeadline = loan.frozenInterestAt + liquidationAdapter.cureWindowSeconds();
        if (block.timestamp < cureDeadline) revert CureWindowStillOpen();

        // Enter irreversible settling state
        loan.status = LoanStatus.LIQUIDATION_SETTLING;
        emit LiquidationSettlingStarted(loanId);

        // Execute the async liquidation
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

        uint256 actualRecovery = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : 0;
        uint256 effectiveRecovery = actualRecovery;

        // Update state
        loan.status = LoanStatus.LIQUIDATED;
        totalBorrowed -= loan.principal;
        availableLiquidity += effectiveRecovery;
        if (loan.principal > effectiveRecovery) {
            totalLiquidity -= (loan.principal - effectiveRecovery);
        }

        positionAdapter.burn(loanId);

        emit LoanLiquidated(loanId, msg.sender, effectiveRecovery, returnedToHolder);
    }

    // ============ Circuit Breaker ============

    function _checkCircuitBreaker() internal {
        if (!cbConfig.enabled) return;

        (uint256 currentPrice, bool trusted, ) = oracleAdapter.getPrice();

        // Untrusted oracle → pause
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
    }

    function unpause() external onlyMarketOwner {
        if (status == MarketStatus.PAUSED_MANUAL) {
            status = MarketStatus.ACTIVE;
            emit MarketResumed(block.timestamp);
        }
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
        LoanStatus status,
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

    function getMarketStats() external view returns (
        uint256 _totalLiquidity,
        uint256 _availableLiquidity,
        uint256 _totalBorrowed,
        uint256 activeLoans,
        MarketStatus marketStatus
    ) {
        uint256 active = 0;
        for (uint256 i = 0; i < nextLoanId; i++) {
            if (loans[i].status == LoanStatus.ACTIVE || loans[i].status == LoanStatus.GRACE_PERIOD || loans[i].status == LoanStatus.LIQUIDATION_CURE) {
                active++;
            }
        }
        return (totalLiquidity, availableLiquidity, totalBorrowed, active, status);
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
        uint256 usdValue18 = Math.mulDiv(amount, price18, 10 ** collateralDecimals);
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
            // Interest frozen at cure entry — no further accrual
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
