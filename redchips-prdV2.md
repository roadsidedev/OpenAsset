# OpenAsset Market — Product Requirements Document

**Version 2.0 — Adapter Architecture**
**Status: Canonical / Source of Truth**

Companion document to the [Technical Reference](./openasset-technical-reference.md) and [Implementation Plan](./openasset-implementation-plan.md). This PRD describes product behavior and user-facing requirements; the Technical Reference is authoritative for contract-level detail.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Target Users](#2-target-users)
3. [Core Features & Requirements](#3-core-features--requirements)
4. [User Flows](#4-user-flows)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Legal & Compliance Requirements](#6-legal--compliance-requirements)
7. [Out of Scope / Deferred](#7-out-of-scope--deferred)

---

## 1. Executive Summary

### 1.1 Vision

OpenAsset Market is permissionless, non-custodial lending infrastructure that lets anyone create an isolated lending market for any tokenized asset with measurable value — from crypto tokens and NFTs to tokenized equities and real-world assets — with full control over risk parameters and terms.

### 1.2 Problem

Existing lending platforms gatekeep which assets can access liquidity: governance-approved listings, protocol-fixed terms, and asset coverage limited to a small set of blue-chip tokens. The result is that the overwhelming majority of on-chain value — gaming assets, niche NFTs, community tokens, and now tokenized equities and RWAs — has no lending utility at all.

### 1.3 Solution

OpenAsset Market separates a stable, narrowly-scoped **lending engine** from a pluggable **adapter layer**. LPs launch markets by selecting (or, permissionlessly, registering) adapters for how collateral is custodied, priced, checked for eligibility, and liquidated — without the core protocol needing to understand any specific asset type. This is what makes "any asset" durable as a promise rather than a roadmap that requires re-auditing the core contracts every time a new asset class is added.

### 1.4 Success Metrics (Year 1)

- 1,000+ markets launched across supported EVM chains
- $50M+ Total Value Locked
- 50,000+ loans originated
- <5% default rate on over-collateralized markets
- At least one live market per adapter category (crypto ERC20, NFT, tokenized equity/RWA) demonstrating the architecture end-to-end
- Zero incidents where a single adapter's failure propagated beyond the markets using it

---

## 2. Target Users

### 2.1 Liquidity Provider (Market Creator)

DeFi-experienced individuals or DAO treasuries deploying capital to earn yield with self-selected risk exposure. Wants: sustainable APR above legacy money markets, control over terms, ability to support a specific community or asset without waiting on governance. Now additionally selects **adapters**, not just numeric parameters — LTV/APR/duration remain simple sliders, but oracle source, compliance requirement, liquidation mechanism, and position representation are explicit choices with visible trust signals (Verified/unverified badges from the Adapter Registry).

### 2.2 Borrower (Asset Holder)

Holders of crypto, NFTs, or (increasingly) tokenized equities/RWAs who want liquidity without selling. Wants: fast access to capital, clear terms, no forced disclosure of exactly *why* an asset isn't eligible for a given market beyond what the Compliance Adapter surfaces.

### 2.3 Asset Project / Community

Gaming DAOs, NFT projects, token communities wanting to give holders DeFi utility without building anything themselves.

### 2.4 RWA / Tokenized-Asset Issuer (new persona)

Entities like broker-dealers or RWA platforms whose tokenized products (equities, treasuries, funds) can be used as OpenAsset Market collateral. Distinct from the other personas because their relationship to OpenAsset Market is largely a **compliance and integration** one — they define transfer eligibility rules that Compliance Adapters must enforce, and (for issuer-redemption liquidation) they define the settlement channel a Liquidation Adapter calls into. Their goals: distribution and utility for their tokenized product, without taking on unbounded legal exposure from how the product is used downstream.

---

## 3. Core Features & Requirements

### Feature 1: Permissionless Market Creation (Adapter-Based)

**Priority:** P0

**User Story:** As an LP, I want to launch a market by selecting adapters and setting simple risk parameters, in one deployment, without approval.

**Creation Flow (replaces the old fixed-parameter-only wizard):**

```
Step 1: Collateral Asset
  ├─ Asset address / type
  ├─ Select Asset Adapter (Verified list shown first, "Register custom
  │   adapter" option available with prominent unverified-risk warning)
  └─ System checks Asset Adapter ↔ asset type compatibility

Step 2: Oracle
  ├─ Select Oracle Adapter appropriate to the asset (UI recommends: TWAP
  │   for crypto-native ERC20, Chainlink Equity Feed for tokenized
  │   equities/RWA — see Technical Reference Section 9)
  └─ Display Verified/unverified status and current TVL secured by this adapter

Step 3: Compliance (optional)
  ├─ "Does this asset require holder eligibility checks?" (Yes/No)
  ├─ If yes: select Compliance Adapter (e.g., ERC-3643, issuer allowlist,
  │   jurisdiction geofence)
  └─ System requires this be set before allowing an async Liquidation
      Adapter or TransferablePosition to be selected together (Factory
      Validation Matrix)

Step 4: Liquidation
  ├─ Select Liquidation Adapter (DEX Swap / NFT Auction / Issuer
  │   Redemption)
  └─ If Issuer Redemption selected: system requires Step 3's Compliance
      Adapter to be non-null, and surfaces the async settlement timeline
      to the LP explicitly before deployment

Step 5: Position Representation
  ├─ Standard (no token) / Soulbound NFT / Transferable NFT
  └─ System recommends Soulbound by default whenever a Compliance
      Adapter is attached, with the reasoning shown inline

Step 6: Risk Parameters
  ├─ LTV, APR, duration, grace period, health factor toggle+threshold,
  │   circuit breaker toggle+thresholds — same simple sliders as before

Step 7: Lending Asset & Liquidity
  ├─ Lending asset — restricted to the stablecoin allowlist (dropdown
  │   only, no free text)
  └─ Initial liquidity deposit + creation fee, same as before

Step 8: Deploy
  └─ Factory runs full Validation Matrix; deployment reverts with a
      specific, human-readable reason on any failure rather than a
      generic revert
```

**Acceptance Criteria:**
- [ ] Every adapter selection surfaces its Verified/unverified badge and current TVL before the LP confirms
- [ ] Attempting an incompatible adapter combination (per the Validation Matrix) is rejected in the UI *before* the transaction is submitted, with the specific rule cited
- [ ] Market deploys in one transaction, live immediately, no approval step
- [ ] Unverified adapter selection requires an explicit additional confirmation checkbox ("I understand this adapter has not been audited by OpenAsset Market")

### Feature 2: Adapter Registry & Verification Surface

**Priority:** P0

**User Story:** As an LP or borrower, I want to see at a glance whether a market's adapters have been independently reviewed, so I can price that risk into my decision.

**Requirements:**
- Public registry page listing all registered adapters by type, with Verified/unverified/deprecated status, audit reference (where applicable), registration date, and current aggregate TVL secured
- Market detail pages surface each of the market's five adapter choices with their individual status
- Deprecation of an adapter does not alter or pause any existing market using it, but does: block that adapter from selection in new markets, add a persistent warning banner to affected existing markets, and notify the affected LP directly

### Feature 3: Borrower Loan Request

**Priority:** P0

Functionally similar to the original spec (collateral deposit → calculated max loan → approval → request → funds released), with two additions:

- **Compliance pre-check**: if the market has a Compliance Adapter, the frontend checks eligibility *before* prompting for a wallet approval transaction, so an ineligible borrower isn't asked to pay gas only to have the transaction revert.
- **Position adapter disclosure**: the loan request confirmation screen states plainly whether the resulting position is transferable, soulbound, or a plain internal record, and what that means in practice (e.g., "This position cannot be sold or transferred" for soulbound).

### Feature 4: Oracle System

**Priority:** P0

Two production oracle paths at launch:
- **`UniswapV3TWAPAdapter`** for crypto-native ERC20 collateral — 10/20/30-minute configurable window based on asset volatility.
- **`ChainlinkEquityFeedAdapter`** for tokenized equities/RWA — session-aware 24/5 pricing, with sequencer-uptime verification on L2 deployments and an explicit "untrusted outside trading window" state on weekends/holidays that routes into the same circuit-breaker pause as any other untrusted-oracle condition.

`ChainlinkAdapter` (plain, non-equity feeds) and `ManualOracleAdapter` remain available as fallbacks, the latter carrying a persistent UI warning wherever it's used.

### Feature 5: Circuit Breaker

**Priority:** P0

Unchanged in behavior from the original design, now explicitly fed by any Oracle Adapter's `isTrusted` signal rather than being tied to a single hardcoded oracle implementation. Pauses new-loan origination on excess volatility *or* on untrusted/stale pricing (including equity-feed weekend gaps and L2 sequencer outages); repayments and liquidations remain available throughout.

### Feature 6: Gradual Liquidation

**Priority:** P0

No longer a standalone feature spec — it is a structural requirement of the `ILiquidationAdapter` interface (Technical Reference, Section 3.4/10): every liquidation adapter must return both the amount recovered for the LP and the amount returned to the position holder. Product-level requirement: the loan dashboard and liquidation-confirmation notifications must display this breakdown explicitly (amount to LP vs. amount returned) for every liquidation event, regardless of which adapter executed it.

### Feature 7: Health Monitoring Dashboard & Alerts

**Priority:** P1

Functionally as originally specced (real-time health factor, liquidation probability forecast, multi-channel alerts), with one architectural change: for any market using `TransferablePositionAdapter`, the backend must track position ownership via on-chain `Transfer` events and resolve the **current** holder before sending any alert — not the original borrower. Alert preferences and history are keyed to the position, not a fixed wallet identity, for these markets.

### Feature 8: RWA & Tokenized Equity Markets

**Priority:** P1

**User Story:** As an LP, I want to launch a market accepting a tokenized equity or RWA token as collateral, with the specific risks of that asset class made visible to me and to borrowers.

**Requirements:**
- Market creation flow must surface, per issuer, a plain-language risk summary distinguishing custody model (e.g., "1:1 custodied, redeemable" vs. "synthetic/offshore debt-security claim") — sourced from a maintained issuer-profile reference, not left to LPs to research independently
- Dividend/corporate-action handling model must be disclosed per issuer (auto-mirrored to balance / NAV-appreciation / off-chain credit not reflected on-chain) before market deployment
- Any market pairing an Issuer Redemption Liquidation Adapter must display the asynchronous settlement timeline (cure window + expected settlement period) to both LP and borrower before origination
- Issuer-insolvency risk disclosure (Technical Reference, Section 12.1) must appear at both market creation and loan origination for any RWA/equity-collateral market — not buried in general Terms of Service alone

### Feature 9: Position Adapters

**Priority:** P0

Three selectable tiers per Technical Reference Section 11. Product-level requirement: the market creation wizard defaults the selection to Soulbound whenever a Compliance Adapter is attached, and to Transferable otherwise, but always allows explicit LP override — with a plain-language explanation of the tradeoff shown at the point of choice, not just in documentation.

---

## 4. User Flows

### Flow 1: LP Creates an RWA Market

```
1. LP selects "Tokenized Equity / RWA" as collateral category
2. Enters issuer's token address; system looks up issuer profile
   (custody model, transfer restriction type, dividend handling) from
   the maintained issuer reference and displays it
3. System recommends ChainlinkEquityFeedAdapter; LP confirms
4. System requires a Compliance Adapter selection (cannot be skipped
   for this collateral category); LP selects the issuer-appropriate
   adapter (e.g., ERC-3643) from the Verified list
5. LP selects Issuer Redemption as the Liquidation Adapter; system
   displays the async settlement flow and requires acknowledgment
6. Position adapter defaults to Soulbound; LP proceeds without
   overriding
7. LP sets LTV/APR/duration/grace period/health factor as usual
8. LP selects lending asset from the stablecoin dropdown
9. Deploys; Factory validates the full matrix (Compliance Adapter
   present ✓, async liquidation paired correctly ✓, lending asset
   allowlisted ✓) and deploys in one transaction
```

### Flow 2: Loan Enters Asynchronous Liquidation

```
1. Loan health factor breaches threshold (or grace period expires)
2. Loan enters LIQUIDATION_CURE; interest freezes immediately;
   borrower/position-holder is notified with the exact cure-window
   deadline and repayment amount (frozen debt + penalty)
3a. Borrower repays within the window → loan closes REPAID,
    collateral released
3b. Window expires → issuer redemption submitted, loan enters
    LIQUIDATION_SETTLING (irreversible); borrower notified that
    repayment is no longer possible
4. Settlement confirms → proceeds distributed per the adapter's
   recoveredForLP / returnedToHolder split → loan closes LIQUIDATED
5. (Exception path) Settlement doesn't confirm within the outer
   timeout → loan flagged for manual LP intervention; LP notified
```

### Flow 3: Borrower Attempts a Loan on a Compliance-Gated Market Without Eligibility

```
1. Borrower browses a tokenized-equity market
2. Frontend checks complianceAdapter.isEligible() before enabling
   the "Request Loan" action
3. Check fails → UI shows the specific reason available from the
   adapter (e.g., "jurisdiction not eligible") without requiring a
   gas-costing on-chain attempt
4. Borrower is shown alternative markets they are eligible for
```

---

## 5. Non-Functional Requirements

Carried forward from the original PRD (page load <2s p75, API <500ms p95, 99.9% uptime, 2+ audits pre-mainnet, TLS 1.3, RBAC for admin functions), with two additions specific to the adapter model:

- **Adapter call latency budget:** any adapter call in the loan-origination or liquidation path must resolve within the same transaction — no adapter design may require off-chain waiting *within* a synchronous flow (async flows use the explicit `LIQUIDATION_CURE` / `LIQUIDATION_SETTLING` states instead, never a blocking wait).
- **Registry availability:** the Adapter Registry's read path (verified/deprecated status) must be available with the same uptime SLA as core market data, since market-creation and borrow-time decisions depend on it being current.

---

## 6. Legal & Compliance Requirements

- Securities/RWA counsel review is a **hard pre-launch gate** for enabling any market that uses a Compliance Adapter — this is a distinct approval step from engineering readiness and must not be treated as satisfied merely because the contracts pass audit.
- Terms of Service must explicitly name issuer insolvency as an uninsured, potentially total-loss risk category, separate from and additional to ordinary collateral price risk.
- The protocol's compliance responsibility boundary (Technical Reference, Section 15) — point-in-time checks only, no continuous monitoring, enforcement of mid-loan eligibility changes happens via the issuer's own token-level freeze mechanism — must be stated in user-facing documentation, not just internal specs, so LPs and borrowers understand what OpenAsset Market does and does not enforce on an ongoing basis.
- Geo-restrictions specific to individual issuers (e.g., a product barred to a certain jurisdiction) must be reflected at the frontend/market level even where not separately enforced by a Compliance Adapter on-chain.

---

## 7. Out of Scope / Deferred

See Technical Reference Section 19 for the full, authoritative list. Summarized for product-planning purposes:

- Reputation-based lending tiers (no reliable on-chain reputation protocol currently exists to build on)
- Agentic (AI-agent) borrowers
- Non-stablecoin lending assets (ETH/BTC) — revisit if demand signals justify it
- Solana / non-EVM chain support — separate design exercise, not a v1 dependency
- Cross-chain unified liquidity or position portability
- Autonomous adapter-verification agent (verification remains human-governed in v1)
