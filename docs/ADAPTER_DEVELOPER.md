# OpenAsset Market — Adapter Framework

**Version 2.0**
**Status: Canonical / Source of Truth**

This is the guide for anyone — third-party developer, issuer's engineering team, or internal contributor — building an adapter for OpenAsset Market. It covers the five adapter interfaces, the multi-tenancy pattern, clone templates for position adapters, registration and verification, and a complete worked example.

If you only read one section before writing code, read Section 2 — it covers structural requirements that aren't obvious from the bare interface signatures.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Two Things the Interfaces Don't Tell You](#2-two-things-the-interfaces-dont-tell-you)
3. [The Five Interfaces — Behavior Beyond the Signature](#3-the-five-interfaces--behavior-beyond-the-signature)
4. [Multi-Tenancy Pattern (Mandatory)](#4-multi-tenancy-pattern-mandatory)
5. [Position Adapters: Clone Templates (Mandatory)](#5-position-adapters-clone-templates-mandatory)
6. [Liquidation Adapters: Orchestrate, Don't Custody](#6-liquidation-adapters-orchestrate-dont-custody)
7. [Requirements Checklist](#7-requirements-checklist)
8. [Testing Requirements Before Submission](#8-testing-requirements-before-submission)
9. [Registration & Verification Process](#9-registration--verification-process)
10. [Worked Example: Building a Pyth Oracle Adapter](#10-worked-example-building-a-pyth-oracle-adapter)
11. [Submission Checklist Template](#11-submission-checklist-template)

---

## 1. Architecture Overview

OpenAsset Market uses a **pluggable adapter architecture**. The core Lending Engine knows exactly four verbs — **escrow, price, check eligibility, liquidate** — and calls out to adapters for each. New asset classes, oracle sources, compliance regimes, and liquidation mechanisms are added by writing and registering a new adapter, not by touching the engine.

```
                         LENDING MARKET
                               │
         ┌──────────────────────┼──────────────────────┬──────────────┐
         │                      │                      │              │
   Asset Adapter         Oracle Adapter       Compliance Adapter  Position Adapter
         │                      │                      │              │
         └──────────────────────┼──────────────────────┴──────────────┘
                               │
                      Liquidation Adapter
                               │
                         LENDING ENGINE
                     (Circuit Breaker · State Machine ·
                      Defensive Invariants · Reentrancy Guards)
```

### 1.1 The Five Adapter Types

| Type | Interface | Purpose |
|------|-----------|---------|
| **Asset** | `IAssetAdapter` | Escrow and release collateral |
| **Oracle** | `IOracleAdapter` | Pricing with trust signal |
| **Compliance** | `IComplianceAdapter` | Participant eligibility checks (optional) |
| **Liquidation** | `ILiquidationAdapter` | Default resolution |
| **Position** | `IPositionAdapter` / `IPositionAdapterInit` | Loan position representation |

### 1.2 What Stays in the Core Engine (Never Pluggable)

- Circuit breaker logic
- Gradual liquidation shape (surplus returned to holder)
- Reentrancy protection and CEI on every adapter call
- Defensive verification of adapter outputs (balance deltas, price sanity)
- Loan state machine (ACTIVE → GRACE → LIQUIDATION_CURE → LIQUIDATION_SETTLING → LIQUIDATED)

---

## 2. Two Things the Interfaces Don't Tell You

### 2.1 Your adapter will serve many markets, not one

Look at `IAssetAdapter.escrow(address from, uint256 amountOrId)`. There's no token address parameter. That's deliberate — Asset, Oracle, Compliance, and Liquidation Adapters are **multi-tenant**: one deployed instance is reused across every market that selects it.

Your adapter stores per-market configuration in a `mapping(address => MarketConfig)` keyed by the calling market's address (`msg.sender`). The Market Factory calls `configure(market, ...)` once per market at deployment time. Do not use constructor-based configuration or hardcoded addresses.

### 2.2 Position Adapters are cloned, not shared

`IPositionAdapter.ownerOf(uint256 loanId)` takes only a loan ID. Since loan IDs are unique only within a single market's counter, a shared instance cannot disambiguate loan #5 in different markets.

**Position Adapters are deployed as EIP-1167 minimal proxy clones** of a template. Each market gets its own clone. The template constructor sets a marker address; `initialize()` is called on each clone after deployment, setting market-specific state. Implement `IPositionAdapterInit` and use OpenZeppelin's `Initializable`.

---

## 3. The Five Interfaces — Behavior Beyond the Signature

### `IAssetAdapter`

```solidity
interface IAssetAdapter {
    function configure(address market, address collateralToken) external;
    function escrow(address from, uint256 amountOrId) external;
    function release(address to, uint256 amountOrId) external;
    function isTransferable(address from, address to, uint256 amountOrId) external view returns (bool);
}
```

- `escrow()` must move collateral `from → msg.sender` (the LendingMarket). The engine verifies balance deltas after the call.
- `release()` must move collateral from `msg.sender` to `to`. The market grants the adapter delegated approval (via `approve(max)` or `setApprovalForAll`) at configuration time.
- `isTransferable()` must reflect **real** constraints — balance, allowance, ownership, issuer freezes. Never return `true` unconditionally.
- `configure()` is called by the Factory once per market. Store the per-market token address.

**Reference implementations:** `ERC20Adapter`, `ERC721Adapter` in `contracts/src/adapters/asset/`.

### `IOracleAdapter`

```solidity
interface IOracleAdapter {
    function configure(address market, address asset) external;
    function getPrice() external view returns (uint256 price, bool isTrusted, uint256 updatedAt);
    function getHistoricalPrice(uint256 secondsAgo) external view returns (uint256);
}
```

- `getPrice()` returns a **single combined trust signal** (`isTrusted`). This covers staleness, sequencer uptime, trading-session awareness, and any other validity check. Do NOT split these into separate flags — the engine reads only one boolean.
- `isTrusted == false` triggers the circuit breaker (market pause).
- `getHistoricalPrice()` should return a genuine historical price from `secondsAgo`, not the latest price. If your feed doesn't support history, revert.

**Reference implementations:** `ChainlinkAdapter`, `UniswapV3TWAPAdapter` in `contracts/src/adapters/oracle/`.

### `IComplianceAdapter`

```solidity
interface IComplianceAdapter {
    function configure(address market) external;
    function isEligible(address participant) external view returns (bool);
}
```

- **Must fail closed.** If your adapter can't determine eligibility — unconfigured market, unreachable dependency, unexpected state — return `false` or revert. Never default to `true`.
- Checked at loan origination (always) and position transfer (for TransferablePosition markets).

**Reference implementation:** `ERC3643ComplianceAdapter` in `contracts/src/adapters/rwa/`.

### `ILiquidationAdapter`

```solidity
interface ILiquidationAdapter {
    function configure(address market, address assetAdapter) external;
    function liquidate(uint256 loanId, uint256 debtOwed) external returns (uint256 recoveredForLP, uint256 returnedToHolder);
    function isAsynchronous() external view returns (bool);
    function cureWindowSeconds() external view returns (uint256);
}
```

- The two return values must reconcile against **actual** tokens moved, not just computed. The engine checks real balance deltas afterward.
- **Orchestrate through the Asset Adapter.** Do not move collateral directly. Call `IAssetAdapter(cfg.assetAdapter).release(lp, recoveredForLP)` for the LP portion and `IAssetAdapter(cfg.assetAdapter).release(holder, returnedToHolder)` for surplus.
- For async adapters (e.g., issuer redemption), return `(0, 0)` from `liquidate()` and settle later via keeper.

**Reference implementations:** `DEXSwapLiquidationAdapter`, `NFTAuctionLiquidationAdapter`, `IssuerRedemptionLiquidationAdapter` in `contracts/src/adapters/liquidation/`.

### `IPositionAdapter` / `IPositionAdapterInit`

```solidity
interface IPositionAdapter {
    function mint(address to, uint256 loanId) external;
    function ownerOf(uint256 loanId) external view returns (address);
    function burn(uint256 loanId) external;
}

interface IPositionAdapterInit is IPositionAdapter {
    function initialize(address factory, address complianceAdapter) external;
}
```

- `ownerOf()` must be the single source of truth for "who is authorized to act on this loan." Collateral release, repayment, and liquidation surplus all defer to this.
- `mint()` and `burn()` must be callable only by the authorized LendingMarket. Use the `onlyMarket` modifier.
- Implement `IPositionAdapterInit` and use OpenZeppelin's `Initializable`. The constructor is a one-time template marker; `initialize()` sets clone-specific state.

**Reference implementations:** `StandardPositionAdapter`, `SoulboundPositionAdapter`, `TransferablePositionAdapter` in `contracts/src/adapters/position/`.

---

## 4. Multi-Tenancy Pattern (Mandatory)

All adapters **except Position Adapters** follow this pattern. A single deployed instance serves many markets.

```solidity
contract MyAdapter is IMyAdapterType {
    address public immutable factory;

    struct MarketConfig {
        // Per-market configuration fields
        address token;
        // ... other fields
    }

    mapping(address => MarketConfig) public marketConfigs;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
    }

    function configure(address market, /* type-specific params */) external onlyFactory {
        require(market != address(0), "Invalid market");
        marketConfigs[market] = MarketConfig({ /* ... */ });
    }

    function adapterFunction( /* ... */ ) external {
        MarketConfig memory config = marketConfigs[msg.sender];
        require(/* configured */, "Unconfigured market");
        // Use config...
    }
}
```

**Rules:**
- `configure()` is called **once** per market by the Factory at deployment time — never by the LP directly, never twice.
- `msg.sender` in every adapter function is the calling LendingMarket contract.
- If your adapter requires additional setup beyond `configure()` (e.g., registering a specific price feed), add a separate factory-only function like `registerFeed(market, feedAddress)`.

---

## 5. Position Adapters: Clone Templates (Mandatory)

Position Adapters are cloned per market via EIP-1167 minimal proxy. You implement a template contract; the Market Factory deploys clones and calls `initialize()`.

```solidity
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract MyPositionAdapter is IPositionAdapterInit, Initializable {
    address public factory;
    mapping(address => bool) public authorizedMarkets;

    /// @notice Template constructor — runs only on the implementation contract
    constructor() {
        factory = address(0xdead); // Marker: this is not a clone
    }

    function initialize(address _factory, address /* complianceAdapter */) external initializer {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        // Set clone-specific state here
    }

    modifier onlyMarket() {
        require(authorizedMarkets[msg.sender], "Unauthorized");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    function registerMarket(address market) external onlyFactory {
        authorizedMarkets[market] = true;
    }

    function mint(address to, uint256 loanId) external override onlyMarket {
        // Implementation
    }
    // ... ownerOf(), burn()
}
```

**Rules:**
- Use OpenZeppelin's `Initializable` and the `initializer` modifier on `initialize()`.
- The template's constructor should set `factory` to a sentinel value (`address(0xdead)`) to distinguish the template from clones.
- `initialize()` must be callable with an empty `complianceAdapter` (address(0)) for markets that don't use one.

---

## 6. Liquidation Adapters: Orchestrate, Don't Custody

A Liquidation Adapter should not hold assets or move them via its own direct token calls. Instead, it reads context back from the market and calls back into the market's configured Asset Adapter:

```solidity
function liquidate(uint256 loanId, uint256 debtOwed)
    external override onlyConfiguredMarket
    returns (uint256 recoveredForLP, uint256 returnedToHolder)
{
    MarketConfig memory config = marketConfigs[msg.sender];

    // Note: msg.sender is the LendingMarket. Read position holder and LP from
    // on-chain state, then call the Asset Adapter to move collateral:

    // IAssetAdapter(config.assetAdapter).release(lp, recoveredForLP);
    // IAssetAdapter(config.assetAdapter).release(holder, returnedToHolder);

    recoveredForLP = debtOwed;
    returnedToHolder = 0;
}
```

This keeps all asset-type-specific movement logic in exactly one place (the Asset Adapter), regardless of whether it's invoked for repayment or liquidation.

---

## 7. Requirements Checklist

Before an adapter can be registered:

- [ ] **Non-upgradeable.** No proxy pattern behind the adapter itself.
- [ ] **Multi-tenancy.** Uses `mapping(address => MarketConfig)`, `configure()` with `onlyFactory`.
- [ ] **No unbounded loops or unpredictable gas** in any function callable from loan-origination or liquidation.
- [ ] **Checks-Effects-Interactions discipline** internally, even though the engine guards reentrancy externally.
- [ ] **Fails closed** — unconfigured/unexpected state returns `false` or reverts, never proceeds.
- [ ] **No `tx.origin`** dependency anywhere.
- [ ] **Documented external dependencies** — which oracle, registry, or issuer contract, and what happens if it becomes unavailable.
- [ ] **Position Adapters specifically:** implements `IPositionAdapterInit`, uses `Initializable`, has `onlyMarket` on mint/burn.
- [ ] **Liquidation Adapters specifically:** orchestrates through Asset Adapter, does not custody collateral directly.
- [ ] **Compliance Adapters specifically:** fail-closed (return false on any error).

---

## 8. Testing Requirements Before Submission

Run these categories yourself before requesting verification:

1. **Happy path** — the adapter works end-to-end wired into a real (testnet) market.
2. **Multi-tenancy correctness** — configure two different markets against the same instance and confirm isolation.
3. **Adversarial input** — zero addresses, zero amounts, nonexistent IDs — test safe failure.
4. **Unconfigured-market calls** — call from an unregistered address; confirm revert, not silent success.
5. **Liquidation Adapters:** verify `recoveredForLP + returnedToHolder` matches actual balance changes.
6. **Position Adapters (Transferable tier):** verify transfer to ineligible recipient reverts when Compliance Adapter is attached.

---

## 9. Registration & Verification Process

1. **Deploy your adapter** to the target chain(s). Use the multi-tenancy pattern with `factory` set to the MarketFactory address.
2. For Position Adapters: deploy the template contract only. The Factory will clone it per market.
3. **Register it** by calling `AdapterRegistry.registerAdapter(address adapter, AdapterType adapterType)`. This is permissionless. Your adapter is now selectable in the Create Market wizard, marked **Unverified**.
4. **(Recommended) Submit for audit.** Provide source code, test results, and external dependency docs.
5. **If it passes:** `AdapterRegistry.markVerified(adapter, auditReference)` is called by the audit-governance multisig. The Verified badge appears automatically.
6. **If it doesn't pass:** fix specific findings and resubmit, or continue operating Unverified — registration itself is never revoked.

### Verification on Registration

The Market Factory validates at market-creation time:
- All adapters must be registered and not deprecated (`registry.isSelectable(adapter)`).
- If an adapter is asynchronous (`isAsynchronous()` returns true), a Compliance Adapter is required.
- The Factory calls `configure()` on each adapter during market deployment, which reverts if the adapter rejects the configuration.

---

## 10. Worked Example: Building a Pyth Oracle Adapter

Walking through the full process for a new Oracle Adapter sourcing from Pyth Network.

**Step 1 — Check the catalog:** Confirm Pyth isn't already supported by checking `AdapterRegistry` on-chain or the [Published Adapters catalog](./openasset-published-adapters.md).

**Step 2 — Implement `IOracleAdapter` with multi-tenancy:**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/adapters/IOracleAdapter.sol";

interface IPyth {
    struct Price {
        int64 price;
        int32 expo;
        uint256 publishTime;
    }
    function getPriceUnsafe(bytes32 id) external view returns (Price memory);
}

contract PythOracleAdapter is IOracleAdapter {
    address public immutable factory;
    IPyth public immutable pyth;
    uint256 public constant MAX_STALENESS = 3600; // 1 hour

    struct MarketConfig {
        bytes32 priceId;
    }

    mapping(address => MarketConfig) public marketConfigs;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory, address _pyth) {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        pyth = IPyth(_pyth);
    }

    function configure(address market, address) external onlyFactory {
        require(market != address(0), "Invalid market");
        // Price ID must be set via registerPriceFeed()
    }

    function registerPriceFeed(address market, bytes32 priceId) external onlyFactory {
        marketConfigs[market] = MarketConfig({ priceId: priceId });
    }

    function getPrice() external view override returns (uint256 price, bool isTrusted, uint256 updatedAt) {
        bytes32 priceId = marketConfigs[msg.sender].priceId;
        require(priceId != bytes32(0), "Unconfigured market");

        IPyth.Price memory p = pyth.getPriceUnsafe(priceId);
        price = _normalize(p);
        updatedAt = p.publishTime;
        isTrusted = p.price > 0 && (block.timestamp - p.publishTime) <= MAX_STALENESS;
    }

    function getHistoricalPrice(uint256) external pure override returns (uint256) {
        revert("Use off-chain price_history for historical lookups");
    }

    function _normalize(IPyth.Price memory p) internal pure returns (uint256) {
        int64 _price = p.price;
        int32 expo = p.expo;
        if (_price <= 0) return 0;
        if (expo >= 0) return uint256(uint64(_price)) * (10 ** (18 + uint32(expo)));
        uint32 negExpo = uint32(-expo);
        return negExpo <= 18
            ? uint256(uint64(_price)) * (10 ** (18 - negExpo))
            : uint256(uint64(_price)) / (10 ** (negExpo - 18));
    }
}
```

**Step 3 — Run the Section 8 test suite** against a testnet deployment.

**Step 4 — Register and submit for verification**, per Section 9.

---

## 11. Submission Checklist Template

```
Adapter name:
Adapter type: [Asset / Oracle / Compliance / Liquidation / Position]
Registry address:
Source repository / commit hash:
External dependencies (contracts, oracles, registries this adapter calls):
Multi-tenancy pattern followed? [Yes / N/A — Position Adapter, cloned per market]
Fails closed on unconfigured/unexpected state? [Yes/No — explain]
Test suite results attached? [Yes/No]
  - Happy path
  - Multi-tenancy isolation
  - Adversarial input
  - Unconfigured-market calls
  - (Liquidation only) recoveredForLP/returnedToHolder reconciliation
  - (Position, Transferable tier only) compliance-gated transfer rejection
Known limitations or risks you want disclosed alongside a Verified mark:
```
