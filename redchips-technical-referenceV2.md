# OpenAsset Market — Technical Reference

**Version 2.0 — Adapter Architecture**
**Status: Canonical / Source of Truth**

This document is the authoritative technical reference for OpenAsset Market. It supersedes all prior monolithic-contract designs. Where earlier drafts described a single `LendingMarket` contract with asset-type branches baked in, this version describes the adapter-based architecture that replaces it. If you find a discrepancy between this document and an older draft, this document is correct.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Core Contracts](#2-core-contracts)
3. [The Adapter System](#3-the-adapter-system)
4. [Adapter Trust Model](#4-adapter-trust-model)
5. [Adapter Registry](#5-adapter-registry)
6. [Market Factory Validation Matrix](#6-market-factory-validation-matrix)
7. [Circuit Breaker (Core)](#7-circuit-breaker-core)
8. [Loan Lifecycle & State Machine](#8-loan-lifecycle--state-machine)
9. [Oracle Adapters](#9-oracle-adapters)
10. [Liquidation Adapters & Gradual Liquidation](#10-liquidation-adapters--gradual-liquidation)
11. [Position Adapters](#11-position-adapters)
12. [RWA & Tokenized Equity Support](#12-rwa--tokenized-equity-support)
13. [Lending Asset Scope](#13-lending-asset-scope)
14. [Multi-Chain Architecture](#14-multi-chain-architecture)
15. [Compliance Responsibility Boundary](#15-compliance-responsibility-boundary)
16. [Security Model](#16-security-model)
17. [Data Models](#17-data-models)
18. [Security Checklist](#18-security-checklist)
19. [Deferred / Out of Scope](#19-deferred--out-of-scope)

---

## 1. Design Philosophy

OpenAsset Market is permissionless, non-custodial lending infrastructure. Anyone can create an isolated lending market for any tokenized asset with measurable value, on their own terms.

### 1.1 Core Principles

- **Permissionless market creation.** No asset-listing committee, no governance approval, no centralized underwriting. A market creator (LP) assumes responsibility for the parameters they configure.
- **Isolated markets.** Each market has its own liquidity, collateral asset, risk parameters, and liquidation mechanism. A failure in one market cannot cascade into another.
- **Non-custodial.** OpenAsset Market never takes discretionary control of user assets. Collateral is locked according to predefined, transparent smart contract rules — not managed by the protocol.
- **Open asset support.** Crypto tokens, NFTs, gaming assets, tokenized equities, RWAs, and asset classes that don't exist yet — all should be supportable without redesigning the core engine.
- **The protocol does not decide which assets deserve financial utility.** The market creator decides. OpenAsset Market provides the infrastructure; it does not underwrite.

### 1.2 The Adapter Principle

The single architectural decision that makes the above sustainable at scale: **the core lending engine must never encode asset-type-specific or issuer-specific logic.** Every time a new asset class needed a new `if/else` branch inside a monolithic `LendingMarket` contract, the whole protocol's audit surface grew. That doesn't scale past a handful of asset types, and it means the contract holding everyone's collateral gets modified — and needs re-auditing — every time you want to support something new.

Instead, the core engine knows exactly four verbs — **escrow, price, check eligibility, liquidate** — and calls out to pluggable adapters for each. New asset classes, new oracle sources, new compliance regimes, and new liquidation mechanisms are added by writing and registering a new adapter, not by touching the engine. A bug in an adapter is contained to the markets that chose it; the engine itself, and the safety guarantees it enforces unconditionally (circuit breaker, gradual liquidation shape, reentrancy protection), stay stable and centrally audited.

**What stays in the core engine, non-negotiably, regardless of which adapters a market uses:**
- Circuit breaker logic
- The requirement that liquidation returns surplus to the collateral holder (gradual liquidation shape)
- Reentrancy protection and Checks-Effects-Interactions on every external call, including adapter calls
- Defensive verification of adapter outputs (see [Section 4](#4-adapter-trust-model))
- The loan state machine

**What's pluggable, per market, chosen by the LP at creation:**
- How collateral is held and released (Asset Adapter)
- Where price comes from (Oracle Adapter)
- Who's eligible to borrow or hold a position (Compliance Adapter — optional)
- How liquidation is executed (Liquidation Adapter)
- How the loan position itself is represented (Position Adapter)

---

## 2. Core Contracts

```
                        RED CHIPS MARKET
                              │
        ┌─────────────────────┼─────────────────────┬──────────────┐
        │                     │                      │              │
  Asset Adapter        Oracle Adapter      Compliance Adapter  Position Adapter
        │                     │                      │              │
        └─────────────────────┼──────────────────────┴──────────────┘
                              │
                     Liquidation Adapter
                              │
                        Lending Engine
                    (Circuit Breaker · State Machine ·
                     Defensive Invariants · Reentrancy Guards)
```

### 2.1 Market Factory

Responsible for permissionless market deployment.

**Responsibilities:**
- Validate market configuration against the [Validation Matrix](#6-market-factory-validation-matrix)
- Deploy a new isolated `LendingMarket` instance
- Wire the chosen adapters (from the [Adapter Registry](#5-adapter-registry)) into the new market
- Register market metadata in the global registry
- Collect creation fees

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MarketFactory is ReentrancyGuard, Ownable {
    uint256 public constant MIN_CREATION_FEE = 0.05 ether;
    uint256 public constant FEE_PERCENT_BPS = 100; // 1%
    uint256 public constant MAX_CREATION_FEE = 0.5 ether;

    address[] public allMarkets;
    mapping(address => address[]) public lpToMarkets;
    mapping(address => address[]) public assetToMarkets;

    AdapterRegistry public immutable registry;
    address[] public allowedLendingAssets; // stablecoin allowlist, see Section 13

    struct MarketConfig {
        address lpAddress;
        address collateralAsset;

        address assetAdapter;
        address oracleAdapter;
        address complianceAdapter;   // address(0) if none required
        address liquidationAdapter;
        address positionAdapter;

        address lendingAsset;        // must be in allowedLendingAssets
        uint256 ltvBasisPoints;
        uint256 aprBasisPoints;
        uint256 durationSeconds;
        uint256 gracePeriodHours;
        bool enableHealthFactor;
        uint256 healthFactorThreshold;
        bool enableCircuitBreaker;
        uint256 pauseThresholdBps;
        uint256 lookbackPeriodSeconds;
        uint256 resumeThresholdBps;
        uint256 cooldownSeconds;
    }

    function createMarket(MarketConfig memory config)
        external payable nonReentrant returns (address marketAddress)
    {
        uint256 creationFee = calculateCreationFee(msg.value);
        uint256 initialLiquidity = msg.value - creationFee;
        require(initialLiquidity > 0, "No liquidity provided");

        _validateMarketConfig(config);          // parameter bounds
        _validateAdapterCompatibility(config);   // see Section 6

        LendingMarket market = new LendingMarket(config);
        marketAddress = address(market);

        (bool success, ) = marketAddress.call{value: initialLiquidity}("");
        require(success, "Liquidity transfer failed");

        allMarkets.push(marketAddress);
        lpToMarkets[config.lpAddress].push(marketAddress);
        assetToMarkets[config.collateralAsset].push(marketAddress);

        (bool feeSuccess, ) = protocolTreasury().call{value: creationFee}("");
        require(feeSuccess, "Fee transfer failed");

        emit MarketCreated(marketAddress, config.lpAddress, config.collateralAsset, initialLiquidity, creationFee);
    }

    function calculateCreationFee(uint256 totalDeposit) public pure returns (uint256) {
        uint256 percentFee = (totalDeposit * FEE_PERCENT_BPS) / 10000;
        if (percentFee < MIN_CREATION_FEE) return MIN_CREATION_FEE;
        if (percentFee > MAX_CREATION_FEE) return MAX_CREATION_FEE;
        return percentFee;
    }
}
```

**Why immutable fee structure:** prevents the protocol from changing terms after LPs have committed capital, and lets LPs compute ROI with certainty.

### 2.2 LendingMarket (the Lending Engine)

Each market is its own isolated contract instance. It owns liquidity accounting, the loan state machine, and the circuit breaker. It never contains asset-type logic — every asset-specific action is delegated to the market's configured adapters.

```solidity
contract LendingMarket is ReentrancyGuard {
    IAssetAdapter public immutable assetAdapter;
    IOracleAdapter public immutable oracleAdapter;
    IComplianceAdapter public immutable complianceAdapter; // may be address(0)
    ILiquidationAdapter public immutable liquidationAdapter;
    IPositionAdapter public immutable positionAdapter;

    address public immutable lp;
    address public immutable lendingAsset; // stablecoin only, see Section 13

    uint256 public totalLiquidity;
    uint256 public availableLiquidity;
    uint256 public totalBorrowed;

    MarketStatus public status;
    uint256 public pausedAt;

    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId;

    enum MarketStatus { ACTIVE, PAUSED_VOLATILITY, PAUSED_STALE_ORACLE, PAUSED_MANUAL }

    struct Loan {
        uint256 collateralAmount;
        uint256 principal;
        uint256 startTime;
        uint256 expiryTime;
        uint256 frozenInterestAt;   // set when entering LIQUIDATION_CURE; 0 otherwise
        LoanStatus status;
    }

    enum LoanStatus {
        ACTIVE,
        GRACE_PERIOD,
        LIQUIDATION_CURE,      // reversible: borrower/holder can still repay
        LIQUIDATION_SETTLING,  // irreversible: async redemption submitted
        REPAID,
        LIQUIDATED
    }

    modifier marketActive() {
        _checkCircuitBreaker();
        require(status == MarketStatus.ACTIVE, "Market not active");
        _;
    }

    function requestLoan(uint256 collateralAmount) external marketActive nonReentrant returns (uint256 loanId) {
        if (address(complianceAdapter) != address(0)) {
            require(complianceAdapter.isEligible(msg.sender), "Not eligible");
        }
        require(
            assetAdapter.isTransferable(msg.sender, address(this), collateralAmount),
            "Collateral not transferable to this market"
        );

        (uint256 price, bool trusted, ) = oracleAdapter.getPrice();
        require(trusted, "Oracle untrusted or stale");
        require(price > 0 && price < MAX_SANE_PRICE, "Oracle price out of bounds");

        uint256 collateralValue = (collateralAmount * price) / 1e18;
        uint256 maxLoan = (collateralValue * ltvBasisPoints) / 10000;
        require(maxLoan > 0 && maxLoan <= availableLiquidity, "Invalid loan size");

        // Defensive invariant: verify the adapter actually delivered collateral (Section 4)
        uint256 balanceBefore = _selfBalanceOf(collateralAsset);
        assetAdapter.escrow(msg.sender, collateralAmount);
        uint256 balanceAfter = _selfBalanceOf(collateralAsset);
        require(balanceAfter - balanceBefore == collateralAmount, "Adapter under-delivered collateral");

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            collateralAmount: collateralAmount,
            principal: maxLoan,
            startTime: block.timestamp,
            expiryTime: block.timestamp + durationSeconds,
            frozenInterestAt: 0,
            status: LoanStatus.ACTIVE
        });

        positionAdapter.mint(msg.sender, loanId);

        availableLiquidity -= maxLoan;
        totalBorrowed += maxLoan;
        IERC20(lendingAsset).transfer(msg.sender, maxLoan);

        emit LoanCreated(loanId, msg.sender, maxLoan);
    }
}
```

---

## 3. The Adapter System

Four interfaces plus one presentation-layer interface define every point where the core engine reaches outside itself.

### 3.1 `IAssetAdapter`

Handles collateral custody. Implementations: `ERC20Adapter`, `ERC721Adapter`, `ERC1155Adapter`, and issuer-specific adapters for permissioned RWA tokens.

```solidity
interface IAssetAdapter {
    function escrow(address from, uint256 amountOrId) external;
    function release(address to, uint256 amountOrId) external;
    function isTransferable(address from, address to, uint256 amountOrId) external view returns (bool);
}
```

### 3.2 `IOracleAdapter`

Handles pricing. Implementations: `UniswapV3TWAPAdapter`, `ChainlinkAdapter`, `ChainlinkEquityFeedAdapter`, `NAVOracleAdapter` (for RWA funds), `ManualOracleAdapter` (last resort, flagged prominently in UI).

```solidity
interface IOracleAdapter {
    /// @dev isTrusted covers staleness, sequencer-liveness (on L2s), AND
    /// session-awareness (e.g. equity feeds outside trading windows). The
    /// engine does not need to know *why* — only whether to act on the price.
    function getPrice() external view returns (uint256 price, bool isTrusted, uint256 updatedAt);
    function getHistoricalPrice(uint256 secondsAgo) external view returns (uint256);
}
```

### 3.3 `IComplianceAdapter`

Handles eligibility. Optional — a market with no compliance requirement simply has `complianceAdapter == address(0)` and skips these checks entirely. Implementations: `ERC3643ComplianceAdapter`, `IssuerAllowlistAdapter`, `JurisdictionGeofenceAdapter`.

```solidity
interface IComplianceAdapter {
    function isEligible(address participant) external view returns (bool);
}
```

Checked at **loan origination** and, for `TransferablePosition` markets, at **every position transfer** (see [Section 11](#11-position-adapters)).

### 3.4 `ILiquidationAdapter`

Handles default resolution. Implementations: `DEXSwapLiquidationAdapter` (divisible crypto collateral), `NFTAuctionLiquidationAdapter` (indivisible collateral), `IssuerRedemptionLiquidationAdapter` (RWA, asynchronous).

```solidity
interface ILiquidationAdapter {
    /// @return recoveredForLP    value taken to satisfy debt + penalty
    /// @return returnedToHolder  surplus returned to the position holder, in
    ///                           whatever form the asset allows (tokens for
    ///                           divisible assets, cash side-payment otherwise)
    function liquidate(uint256 loanId, uint256 debtOwed)
        external returns (uint256 recoveredForLP, uint256 returnedToHolder);

    /// @dev Async adapters (issuer redemption) return true. The engine routes
    /// these through LIQUIDATION_CURE / LIQUIDATION_SETTLING instead of
    /// resolving in one transaction. See Section 8.
    function isAsynchronous() external view returns (bool);

    /// @dev Only meaningful when isAsynchronous() == true. Defines how long
    /// a loan sits in LIQUIDATION_CURE before the redemption is irreversibly
    /// submitted. Adapter-instance-specific because different issuers have
    /// different real-world cutoffs for cancelling a redemption.
    function cureWindowSeconds() external view returns (uint256);
}
```

**Gradual liquidation is not a separate adapter — it is a shape every `ILiquidationAdapter` implementation must satisfy.** The interface's two-return-value contract (`recoveredForLP`, `returnedToHolder`) forces every implementation to account for surplus, rather than treating "take everything" as an acceptable default. A DEX-swap adapter for a divisible ERC20 returns genuine token surplus back to the holder. An NFT-auction adapter, which cannot split an indivisible asset, returns `0` in token terms and instead pays any surplus as a cash side-payment. An issuer-redemption adapter returns whatever the issuer's redemption process yields back after debt is satisfied. The fairness principle — take only what's owed, return the rest — is enforced by the interface contract itself, not left to adapter authors' discretion.

### 3.5 `IPositionAdapter`

Handles how a loan position is represented and who's authorized to act on it. See [Section 11](#11-position-adapters) for full detail.

```solidity
interface IPositionAdapter {
    function mint(address to, uint256 loanId) external;
    function ownerOf(uint256 loanId) external view returns (address);
    function burn(uint256 loanId) external; // called on repay or liquidation
}
```

---

## 4. Adapter Trust Model

The hybrid registry ([Section 5](#5-adapter-registry)) means an adapter can be either **Verified** (passed OpenAsset Market' internal audit) or **unverified** (registered permissionlessly, used at the LP's own judgment, surfaced with a prominent risk warning). This is a *process* control — it governs whether a human reviewer has vouched for the code.

**It does not change how the core engine treats the adapter at the code level.** Verified and unverified adapters are called identically, and the engine independently verifies their outputs in both cases. Verification reduces the *probability* a bug exists; it does not eliminate the *need* for the engine to defend itself. Treating a Verified adapter as fully trusted at the contract level would mean a single missed bug in review becomes a protocol-wide vulnerability instead of a contained one — precisely the failure mode the adapter architecture exists to prevent.

**Concrete defensive invariants the engine enforces on every adapter call, regardless of verification status:**

| Adapter call | Defensive check |
|---|---|
| `assetAdapter.escrow()` | Verify actual balance delta received matches the requested amount — never assume success from a non-reverting call |
| `oracleAdapter.getPrice()` | Reject `isTrusted == false`; bound the returned price against a hard sanity ceiling/floor before acting on it |
| `oracleAdapter.getPrice()` (repeat calls) | Bound the magnitude of change between consecutive reads used in the same transaction, to catch a compromised or buggy adapter returning wildly inconsistent values |
| `complianceAdapter.isEligible()` | Treat any revert as `false` (fail closed), never fail open on an unexpected error |
| `liquidationAdapter.liquidate()` | Verify `recoveredForLP + returnedToHolder` accounting reconciles against the asset actually received back from escrow |
| Every adapter call | Full Checks-Effects-Interactions ordering and `nonReentrant` guarding — each adapter call is an external call to semi-trusted code, not an internal function |

This section is the single most important piece of the trust model and should be treated as a non-negotiable engineering requirement during implementation, independent of how rigorous the Verified-adapter review process becomes over time.

---

## 5. Adapter Registry

**Model: hybrid.** Registration is permissionless — anyone can deploy an adapter conforming to one of the five interfaces and register it. The Registry's role is not to gate what exists, but to attach and surface trust metadata so market creators can make an informed choice.

```solidity
contract AdapterRegistry {
    enum AdapterType { ASSET, ORACLE, COMPLIANCE, LIQUIDATION, POSITION }

    struct AdapterInfo {
        address adapterAddress;
        AdapterType adapterType;
        address registeredBy;
        bool verified;          // set only via internal audit sign-off
        bool deprecated;        // see below
        string auditReference;  // firm/report identifier once verified
        uint256 registeredAt;
        uint256 totalValueSecured; // TVL currently flowing through markets using this adapter
    }

    mapping(address => AdapterInfo) public adapters;

    function registerAdapter(address adapter, AdapterType adapterType) external {
        require(adapters[adapter].adapterAddress == address(0), "Already registered");
        adapters[adapter] = AdapterInfo({
            adapterAddress: adapter,
            adapterType: adapterType,
            registeredBy: msg.sender,
            verified: false,
            deprecated: false,
            auditReference: "",
            registeredAt: block.timestamp,
            totalValueSecured: 0
        });
        emit AdapterRegistered(adapter, adapterType, msg.sender);
    }

    /// @dev Restricted to OpenAsset Market' internal audit sign-off process — the
    /// same governance/multisig control as protocol treasury actions.
    /// Long-term, this function may be called by an autonomous audit agent;
    /// that is an explicit future-work item, not part of the v1 design.
    function markVerified(address adapter, string calldata auditReference) external onlyAuditGovernance {
        adapters[adapter].verified = true;
        adapters[adapter].auditReference = auditReference;
        emit AdapterVerified(adapter, auditReference);
    }

    /// @dev Deprecation does NOT retroactively pause markets already using
    /// this adapter — consistent with "market creator controls their
    /// market." It DOES: (1) block the adapter from selection in any new
    /// market, (2) surface a persistent warning on existing markets still
    /// wired to it, (3) directly notify the affected LP(s).
    function markDeprecated(address adapter, string calldata reason) external onlyAuditGovernance {
        adapters[adapter].deprecated = true;
        emit AdapterDeprecated(adapter, reason);
    }
}
```

**Verification process:** an adapter goes through OpenAsset Market' internal audit; if it satisfies review, it receives the `verified` mark and an audit reference. Unverified adapters remain usable — the philosophy is "surface the risk, don't block the door" — but the market creation UI must display unverified status as prominently as the existing "Manual Oracle — use at your own risk" warning pattern, including at point of borrower decision-making, not just LP decision-making.

**Reference adapters:** OpenAsset Market ships a small set of protocol-authored, pre-verified adapters at launch — `ERC20Adapter`, `ERC721Adapter`, `UniswapV3TWAPAdapter`, `ChainlinkAdapter`, `DEXSwapLiquidationAdapter`, `NFTAuctionLiquidationAdapter`, `StandardPositionAdapter`, `SoulboundPositionAdapter`, `TransferablePositionAdapter` — so the large majority of real usage runs through vetted code even though the registry door stays open to anyone.

---

## 6. Market Factory Validation Matrix

Adapter compatibility is not left to LP judgment or an implicit compatibility checker (which would itself be untrusted code with its own bug surface). The Factory enforces an explicit, auditable rule table at market creation. Deployment reverts if any rule fails.

| Rule | Rationale |
|---|---|
| If `positionAdapter == TransferablePosition` AND `complianceAdapter != address(0)`, the position adapter's transfer hook **must** call `complianceAdapter.isEligible(recipient)` | Prevents the position NFT itself from becoming an unregulated side-door around a compliance rule enforced at origination but not at resale |
| If `liquidationAdapter.isAsynchronous() == true`, `complianceAdapter` **must not** be `address(0)` | An async (issuer-redemption) liquidation assumes the caller is itself an eligible party with the issuer; a market with no compliance layer has no eligible caller by construction |
| `lendingAsset` **must** be present in the protocol stablecoin allowlist | Ties to the stablecoin-only lending-asset restriction (Section 13); enforced at the Factory, not left to LP discretion |
| `oracleAdapter`'s declared covered asset type **must** match `assetAdapter`'s declared asset type | Prevents mismatched pairings (e.g., a crypto TWAP oracle wired to an equity Asset Adapter) |
| If `assetAdapter` is flagged as a permissioned/compliance-gated token type, `complianceAdapter` **must not** be `address(0)` | A permissioned asset with no compliance layer means the market itself cannot legally originate the loan in the first place |

This table is deliberately small and explicit rather than general-purpose, so it remains fully auditable in a single read. New rules are added here, not inferred by the Factory at runtime.

---

## 7. Circuit Breaker (Core)

The circuit breaker is core engine logic, **not** an adapter — deliberately. If it were pluggable, an LP could functionally disable it by choosing (or writing) an oracle adapter that never reports high volatility. The Oracle Adapter's only job is to report a price and whether it's currently trustworthy; the engine alone decides what to do with that signal.

```solidity
function _checkCircuitBreaker() internal {
    if (!circuitBreakerEnabled) return;

    (uint256 currentPrice, bool trusted, ) = oracleAdapter.getPrice();

    if (!trusted) {
        // Includes weekend/holiday staleness windows for equity feeds,
        // and L2 sequencer downtime — same pause behavior either way.
        if (status == MarketStatus.ACTIVE) {
            status = MarketStatus.PAUSED_STALE_ORACLE;
            pausedAt = block.timestamp;
            emit CircuitBreakerTriggered("stale_or_untrusted_oracle", block.timestamp);
        }
        return;
    }

    uint256 historicalPrice = oracleAdapter.getHistoricalPrice(lookbackPeriodSeconds);
    uint256 priceChange = currentPrice > historicalPrice
        ? ((currentPrice - historicalPrice) * 10000) / historicalPrice
        : ((historicalPrice - currentPrice) * 10000) / historicalPrice;

    if (priceChange >= pauseThresholdBps && status == MarketStatus.ACTIVE) {
        status = MarketStatus.PAUSED_VOLATILITY;
        pausedAt = block.timestamp;
        emit CircuitBreakerTriggered("volatility", block.timestamp);
    }

    if (status == MarketStatus.PAUSED_VOLATILITY || status == MarketStatus.PAUSED_STALE_ORACLE) {
        bool cooldownPassed = block.timestamp >= pausedAt + cooldownSeconds;
        bool conditionsNormal = trusted && priceChange < resumeThresholdBps;
        if (cooldownPassed && conditionsNormal) {
            status = MarketStatus.ACTIVE;
            emit MarketResumed(block.timestamp);
        }
    }
}
```

**What's always allowed during any paused state:** repayments, liquidations, LP withdrawal of available (unlent) liquidity. **What's blocked:** new loan origination only.

**LP configuration at market creation:** enable/disable, pause threshold (bps move over lookback window), resume threshold, cooldown period. LPs may also manually override (force-resume) a paused market, or manually pause at any time.

---

## 8. Loan Lifecycle & State Machine

### 8.1 Synchronous path (default — most markets)

```
ACTIVE → GRACE_PERIOD → LIQUIDATED
   ↓ (repay)              ↓ (repay during grace)
 REPAID                 REPAID
```

Applies whenever the market's `ILiquidationAdapter.isAsynchronous() == false` (DEX swap, NFT auction). Liquidation resolves in one transaction, exactly as in prior drafts.

### 8.2 Asynchronous path (issuer-redemption / RWA markets only)

```
ACTIVE → GRACE_PERIOD → LIQUIDATION_CURE → LIQUIDATION_SETTLING → LIQUIDATED
              ↓                  ↓ (repay — still reversible)
           REPAID              REPAID
                                                    ↓ (settlement never confirms
                                                       within outer timeout)
                                              Flagged for manual LP intervention
```

**`LIQUIDATION_CURE`:** entered the moment liquidation conditions are first met (grace expired, or health factor breached). Interest accrual **freezes immediately** at entry (`frozenInterestAt = block.timestamp`) — the borrower's debt does not keep growing while the position sits in this reversible state. The window length is set **per liquidation-adapter instance**, not globally, since different issuers have different real-world cutoffs for cancelling a submitted redemption instruction.

During this window, the current position holder (see [Section 11](#11-position-adapters) — for soulbound RWA positions, this is unambiguously the original borrower) **may repay** the frozen debt: principal + frozen interest + the liquidation penalty. The penalty is charged even here — this is a genuine default event that has already occurred, not a courtesy extension, and waiving it would blunt the incentive to cure before triggering conditions in the first place. (LPs may configure this penalty-on-cure as a per-market parameter if a market wants different behavior; the default is non-zero.)

**`LIQUIDATION_SETTLING`:** entered when the cure window expires without repayment. The liquidation adapter's `liquidate()` fires, submitting the redemption request to the issuer. **This is irreversible** — the collateral is now committed to the issuer's settlement pipeline; there is nothing left on OpenAsset Market' side to reverse.

**Settlement confirmation:** via issuer callback or keeper-polled confirmation, proceeds are distributed and the loan moves to `LIQUIDATED`.

**Settlement timeout:** if confirmation doesn't arrive within an outer timeout (calibrated beyond the issuer's expected T+1/T+2 settlement window), the loan is flagged for manual LP intervention rather than left silently stuck. This is the operational point where issuer-insolvency risk (Section 12.1) becomes concrete rather than theoretical.

---

## 9. Oracle Adapters

| Adapter | Asset class | Manipulation resistance model | Notes |
|---|---|---|---|
| `UniswapV3TWAPAdapter` | Crypto-native ERC20 (gaming tokens, meme tokens, DeFi assets) | Time-weighted average (10–30 min, LP-configured), makes flash-loan manipulation economically infeasible | Primary choice where DEX liquidity is sufficient (>$50k recommended) |
| `ChainlinkAdapter` | Crypto assets without sufficient DEX liquidity | Decentralized node network, staleness check (revert if `updatedAt` > 1hr old) | Fallback path |
| `ChainlinkEquityFeedAdapter` | Tokenized equities, ETFs, RWA with an issuer-provided Chainlink feed | Session-aware smoothing across pre-market/regular/after-hours; **24/5, not 24/7** — no live pricing over weekends/market holidays | **Do not use TWAP for this asset class.** The relevant pools barely exist and aren't the authoritative price; the real reference is aggregated multi-venue equity market data, which Chainlink's tokenized equity feeds are purpose-built for. Must additionally check L2 sequencer uptime before trusting a read (sequencer downtime can freeze feeds at a stale value). Outside the 24/5 trusted window, `isTrusted` returns `false` — routes through the same circuit-breaker pause path as any other untrusted-oracle condition |
| `NAVOracleAdapter` | Fund-like RWA (tokenized treasuries, private credit) | Issuer-published NAV, ideally paired with Chainlink Proof of Reserve | Requires issuer cooperation |
| `ManualOracleAdapter` | Illiquid/exotic assets with no reliable feed | LP-updated price, valid for 24hrs | Not recommended for production markets; UI must flag prominently at both market-creation and borrow-time |

---

## 10. Liquidation Adapters & Gradual Liquidation

| Adapter | Collateral type | `recoveredForLP` / `returnedToHolder` shape | Synchronous? |
|---|---|---|---|
| `DEXSwapLiquidationAdapter` | Divisible ERC20 | Exact tokens needed to cover debt+penalty transferred to LP; remainder (real tokens) returned to holder | Yes |
| `NFTAuctionLiquidationAdapter` | Indivisible ERC721/1155 | Full NFT transferred to LP; any surplus (floor value minus debt) paid as an ETH/stablecoin side-payment from LP's available liquidity | Yes |
| `IssuerRedemptionLiquidationAdapter` | RWA / tokenized equity with issuer mint-burn channel | Redemption proceeds split per debt owed vs. surplus, once settlement confirms | **No — async, see Section 8.2** |

All three satisfy the same fairness contract from `ILiquidationAdapter`: take only what's owed plus the configured penalty, return the rest. This is enforced by the interface shape itself, not by adapter-author discretion.

---

## 11. Position Adapters

A loan position's representation determines who can act on it (repay, receive collateral back, receive liquidation surplus) and whether that right is transferable.

| Tier | Representation | Transferable? | Default use case |
|---|---|---|---|
| `StandardPositionAdapter` | Plain internal struct, no token minted | No | Simple crypto-native markets with no compliance requirement and no need for secondary-market/tooling benefits. Cheapest gas, lowest complexity. |
| `SoulboundPositionAdapter` | ERC721 minted, transfer always reverts | No | **Default for any market with a non-null Compliance Adapter** — RWA, tokenized equities, any issuer-permissioned asset. Gets wallet visibility, cross-market enumeration via standard NFT tooling, and third-party/institutional reporting compatibility, with zero compliance-bypass risk since it can never change hands. |
| `TransferablePositionAdapter` | Full ERC721, transferable | Yes, gated through `complianceAdapter.isEligible()` on transfer if one is attached (see Validation Matrix, Section 6) | Crypto-native collateral markets (gaming tokens, memes, generic NFT collateral) where there's no eligibility rule to bypass and the secondary-market/composability upside (selling a position, using it as collateral elsewhere, atomic refinancing) is highest. |

### Why NFT representation matters even when soulbound (transfer value ≠ representation value)

For a single loan in isolation, all three tiers behave identically to the borrower and LP — same repayment, same liquidation, same math. The value of NFT representation (soulbound or transferable) is entirely about **aggregation and tooling at platform scale**, not individual-loan mechanics:

- **Cross-market enumeration for free.** With hundreds of markets across chains, "show me all of a user's loans" via plain structs means OpenAsset Market building and maintaining bespoke per-market, per-chain indexing forever. With ERC721, off-the-shelf infrastructure (block explorers, NFT APIs) already knows how to enumerate "every token this address holds" with zero custom work.
- **Wallet-native visibility** — a position shows up in any standard wallet automatically.
- **Standardized metadata** (`tokenURI`) — third-party portfolio trackers, tax tools, and institutional back-office systems can render position state without integrating with OpenAsset Market specifically. This matters disproportionately for the institutional RWA use case, where such tooling already exists and expects standard token interfaces.

### The compliance hole this design specifically closes

A `TransferablePosition` in a compliance-gated market would otherwise let a KYC'd borrower originate a loan, then sell the position NFT on any generic marketplace to someone who was never checked — the collateral stays compliant, but economic control passes to an ineligible party. Soulbound representation for compliance-gated markets closes this by construction (it can never be sold), and the Validation Matrix additionally enforces the transfer-hook check for any market that does choose `TransferablePosition` alongside a Compliance Adapter.

---

## 12. RWA & Tokenized Equity Support

### 12.1 Issuer/Counterparty Risk — a distinct, undocumented-in-code risk category

Every tokenized equity or RWA token is a **claim on an issuer**, not a bearer asset secured purely by code. If the issuing entity (a broker-dealer, an offshore SPV, a fund administrator) becomes insolvent, halts redemptions, or is shut down by a regulator, the token can go to zero or become permanently frozen — **independent of the underlying stock or asset's price**, and independent of anything OpenAsset Market' liquidation mechanics can address.

**This is out of the protocol's control by construction.** No adapter, no liquidation logic, and no engineering effort changes this. It must be:
1. Surfaced plainly in the market creation UI, per-issuer (e.g., "Collateral type: Tokenized equity (Issuer X) — synthetic/offshore debt-security claim, not directly redeemable for shares" vs. "1:1 custodied, redeemable").
2. Stated explicitly in Terms of Service as an uninsured, total-loss-possible risk category that LPs and borrowers bear knowingly, distinct from ordinary market/price risk.

### 12.2 Transfer Restriction Models

| Model | Example issuers | Integration implication |
|---|---|---|
| Freely transferable | Backed Finance (bTokens) | Standard `ERC20Adapter` works unmodified |
| Permissioned / identity-gated (ERC-3643 / T-REX and similar) | Superstate, likely future institutional issuers | Requires `ERC3643ComplianceAdapter`; the `LendingMarket` contract itself (or a shared vault) must complete the issuer's onboarding to become a whitelisted holder before any market can escrow the token at all — this is a business-development task per issuer, not solved by writing the adapter |
| Issuer-specific / evolving | Robinhood Stock Tokens | Transferability and on-chain compliance mechanics should be verified directly against current issuer documentation before any market launches — do not assume behavior from precedent |

### 12.3 Corporate Actions & Dividends

Handling varies by issuer and must be verified per integration, not assumed:

- **Auto-mirrored to token balance** (e.g., Dinari-style): dividends/splits reflected directly on-chain; no extra engineering needed, collateral value updates automatically via the oracle price.
- **Total-return / NAV appreciation** (e.g., Ondo-style): dividends reinvested into the token's underlying value rather than distributed; also requires no extra engineering, since the price feed already reflects it.
- **Off-chain cash credit, not reflected on-chain**: some issuers currently credit dividend value inside their own app/ledger rather than the token itself. In this model, whichever entity the issuer's internal ledger recognizes as "holder of record" (which may be the `LendingMarket` escrow contract, not the actual borrower, while collateral is locked) receives that credit — **not the borrower**, unless the issuer provides a pass-through mechanism. This must be confirmed directly with each such issuer before listing a market, and disclosed plainly to borrowers as an economic consideration of collateralizing that asset.

### 12.4 Oracle: Chainlink Equity Feeds, Not TWAP

Covered in [Section 9](#9-oracle-adapters) — repeated here because it's the most common mistake to default back into. Equity/RWA markets require `ChainlinkEquityFeedAdapter` (or an equivalent issuer/NAV oracle), never `UniswapV3TWAPAdapter`.

---

## 13. Lending Asset Scope

**v1 restriction: the lending (borrowed-out) asset is stablecoins only.** This is a Factory-enforced allowlist, not LP discretion (see Validation Matrix, Section 6). Borrowers receive stablecoin proceeds and are free to convert to any other asset outside the protocol.

This intentionally keeps adapter-ization scoped to the *collateral* side only for now — expanding pluggable-asset logic to both sides of a loan simultaneously would meaningfully multiply audit surface for limited near-term benefit. Non-stablecoin lending assets (ETH, BTC) are an explicit, demand-gated future item — see [Section 19](#19-deferred--out-of-scope).

---

## 14. Multi-Chain Architecture

**v1 scope is EVM chains only**, using the adapter interfaces defined in this document (Ethereum, Base, Arbitrum, Optimism, Polygon, and EVM-compatible RWA-specific chains such as Robinhood Chain).

**Solana is explicitly not a port of the EVM adapter interfaces.** Anchor's account model has no equivalent plug-and-play adapter pattern — a Solana market's "adapter" is really a specific program/account the core logic is pointed at, which is a distinct design exercise from what's specified here. Solana support is deferred to its own dedicated architecture document, not assumed to follow from this one. Multi-chain deployment in v1 means separate, chain-native deployments per EVM chain (each with its own Factory/Registry instance), not a unified cross-chain liquidity layer — cross-chain composability is deferred (Section 19).

---

## 15. Compliance Responsibility Boundary

This boundary must be stated explicitly so it is never assumed to be handled by a mechanism that doesn't exist:

- The `IComplianceAdapter` performs **point-in-time checks** at specific protocol actions: loan origination, and position transfer for `TransferablePosition` markets. It is **not a continuous monitor** of real-world eligibility.
- If a participant's eligibility status changes mid-loan (e.g., a sanctions designation, a revoked KYC credential), OpenAsset Market **does not poll for this**. Enforcement of that change happens through the **underlying token issuer's own freeze mechanism** — a capability required by standards like ERC-3643 — acting directly on the token, entirely outside OpenAsset Market' contracts.
- OpenAsset Market does not define who qualifies as an eligible investor, which jurisdictions are permitted, or what KYC/AML standard applies. Those rules belong to the asset issuer and applicable regulators; OpenAsset Market' Compliance Adapters enforce whatever rule already exists at the asset level. The protocol remains permissionless at the market-creation layer; eligibility restrictions, where they exist, are a property of the specific asset a market chose to support — not a policy imposed by OpenAsset Market itself.

---

## 16. Security Model

### 16.1 Reentrancy & CEI

Every state-changing function uses `nonReentrant`, and every adapter call — being a call to semi-trusted external code — follows strict Checks-Effects-Interactions ordering: validate, update internal state, *then* call out to the adapter.

### 16.2 Integer Overflow Protection

Solidity `^0.8.20` default overflow checks apply throughout. `unchecked{}` blocks are used only where overflow is provably impossible given realistic parameter bounds (e.g., interest calculation with capped principal/APR/duration), and each such block carries an inline comment justifying the safety argument.

### 16.3 Adapter Trust Boundary

See [Section 4](#4-adapter-trust-model) in full — this is the primary security model addition in v2.0 and should be treated as equally load-bearing as reentrancy protection during audit.

### 16.4 Issuer Insolvency

See [Section 12.1](#121-issuerc­ounterparty-risk--a-distinct-undocumented-in-code-risk-category) — explicitly not a code-level problem; a documentation, disclosure, and legal (ToS) requirement.

---

## 17. Data Models

### 17.1 On-Chain

```solidity
struct Loan {
    uint256 collateralAmount;
    uint256 principal;
    uint256 startTime;
    uint256 expiryTime;
    uint256 frozenInterestAt; // 0 unless in LIQUIDATION_CURE or beyond
    LoanStatus status;
}
```

### 17.2 Off-Chain (PostgreSQL)

```sql
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    contract_address VARCHAR(66) UNIQUE NOT NULL,
    chain_id INTEGER NOT NULL,
    lp_address VARCHAR(66) NOT NULL,
    collateral_asset VARCHAR(66) NOT NULL,
    lending_asset VARCHAR(66) NOT NULL,       -- must be in stablecoin allowlist

    asset_adapter VARCHAR(66) NOT NULL,
    oracle_adapter VARCHAR(66) NOT NULL,
    compliance_adapter VARCHAR(66),           -- nullable
    liquidation_adapter VARCHAR(66) NOT NULL,
    position_adapter VARCHAR(66) NOT NULL,

    ltv_bps INTEGER NOT NULL,
    apr_bps INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE adapters (
    id SERIAL PRIMARY KEY,
    adapter_address VARCHAR(66) UNIQUE NOT NULL,
    adapter_type VARCHAR(20) NOT NULL CHECK (adapter_type IN ('ASSET','ORACLE','COMPLIANCE','LIQUIDATION','POSITION')),
    verified BOOLEAN DEFAULT FALSE,
    deprecated BOOLEAN DEFAULT FALSE,
    audit_reference TEXT,
    total_value_secured DECIMAL(30, 18) DEFAULT 0,
    registered_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    loan_id_onchain INTEGER NOT NULL,
    market_address VARCHAR(66) NOT NULL,
    position_holder_address VARCHAR(66) NOT NULL, -- current holder; must be
                                                     -- re-resolved on Transfer
                                                     -- events for TransferablePosition
    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (
        status IN ('ACTIVE','GRACE_PERIOD','LIQUIDATION_CURE','LIQUIDATION_SETTLING','REPAID','LIQUIDATED')
    ),
    health_factor DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexer note:** for any market using `TransferablePositionAdapter`, the backend indexer must listen for `Transfer` events on the position NFT and update `position_holder_address` accordingly. Health-alert notifications must resolve current holder before sending — never assume the original borrower remains the correct recipient.

---

## 18. Security Checklist

- [ ] Core engine independently verifies every adapter's output (Section 4) — not just for unverified adapters, for all of them
- [ ] Reentrancy guards and CEI ordering on every adapter call, not only user-facing entry points
- [ ] Market Factory validation matrix (Section 6) enforced and unit-tested for every listed rule, including negative tests (deployment must revert on each violation)
- [ ] Circuit breaker tested under both volatility and stale/untrusted-oracle trigger conditions
- [ ] Async liquidation state machine tested for: cure-window repayment, cure-window expiry, settlement confirmation, and settlement timeout → manual flag
- [ ] `TransferablePosition` + Compliance Adapter combination tested specifically for the transfer-hook eligibility check
- [ ] Adapter Registry `markVerified` / `markDeprecated` restricted to audit-governance multisig, not a single key
- [ ] Deprecation behavior tested: blocks new-market selection, does not force-pause existing markets, notifies affected LPs
- [ ] Reference adapters (ERC20, ERC721, Uniswap V3 TWAP, Chainlink, Chainlink Equity Feed, DEX-swap liquidation, NFT-auction liquidation, Standard/Soulbound/Transferable position) independently audited before being marked Verified
- [ ] Legal/securities counsel review completed before any market using a Compliance Adapter (RWA, tokenized equity, any issuer-permissioned asset) is enabled for real users
- [ ] Terms of Service explicitly disclose issuer-insolvency as an uninsured, total-loss risk category distinct from market/price risk
- [ ] All prior baseline items retained: 2+ independent audits, bug bounty live, >90% test coverage, multisig treasury, incident response plan documented

---

## 19. Deferred / Out of Scope

Explicitly considered and deliberately excluded from v1, to keep the record clear for future readers:

- **Reputation-based lending tiers.** No sufficiently reliable on-chain reputation protocol currently exists to build on. A native OpenAsset Market composite score is a plausible post-launch initiative once real usage data exists, not a v1 dependency.
- **Agentic borrowers.** Autonomous-agent-as-borrower support (dynamic collateral tracking, sub-hour loan durations, agent registries) was explored and set aside; the current architecture is human/wallet-borrower-first. Nothing here precludes revisiting it later, but no part of v1 should assume agent-specific behavior.
- **Non-stablecoin lending assets.** ETH/BTC as the borrowed-out asset is deferred until demand signals justify the added adapter-ization scope on the lending side (Section 13).
- **Solana / non-EVM chains.** Deferred to a separate, purpose-built design — not a port of the interfaces in this document (Section 14).
- **Cross-chain unified liquidity, cross-chain position portability, shared cross-chain reputation/analytics.** Each chain deployment remains local and independent in v1.
- **Autonomous adapter-verification agent.** Verification is a human-governed process for now (Section 5); an automated agent performing this role is a plausible long-term evolution, not a v1 build item.
