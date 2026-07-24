# OpenAsset Market — Implementation Plan

**Version 2.0 — Adapter Architecture**
**Status: Canonical / Source of Truth**

Companion to the [Technical Reference](./openasset-technical-reference.md) and [PRD](./openasset-prd.md). Sequencing here reflects the core lesson of the v2.0 redesign: **build and harden the engine and its adapter interfaces before building any specific asset-class support**, since every subsequent asset class is only as safe as the interface contract and the defensive invariants it plugs into.

---

## Sequencing Principle

The single biggest change from the original monolithic plan: **RWA/equity support, NFT support, and even the reference ERC20 adapter are all downstream of the same foundational work** — the four core interfaces, the Factory validation matrix, and the adapter trust model. Building any asset-specific adapter before that foundation is solid means re-doing it once the interfaces stabilize. Phases below reflect that dependency order.

---

## Phase 0: Foundation (Weeks 1–2)

Unchanged from prior planning: repo setup, Hardhat/testing framework, CI/CD skeleton, database/Redis scaffolding, wallet-connect frontend skeleton, design system basics. See team structure and budget notes at the end of this document — those are unaffected by the architecture change.

---

## Phase 1: Core Engine + Adapter Interfaces (Weeks 3–5)

**This phase did not exist in the original plan and is now the critical path.** Nothing asset-specific is built here — only the contracts every future adapter and market will depend on.

- [ ] Define and freeze the five interfaces: `IAssetAdapter`, `IOracleAdapter`, `IComplianceAdapter`, `ILiquidationAdapter`, `IPositionAdapter` (Technical Reference, Section 3)
- [ ] Implement `LendingMarket` core engine against these interfaces only — no concrete adapter logic inside it
- [ ] Implement the full loan state machine, including both the synchronous path and the async `LIQUIDATION_CURE` / `LIQUIDATION_SETTLING` path (Technical Reference, Section 8), even though no async adapter exists yet — test the state machine against a mock async adapter
- [ ] Implement Circuit Breaker as core logic, fed by a mock `IOracleAdapter` in tests (Section 7)
- [ ] Implement every defensive invariant check from the Adapter Trust Model (Section 4) — balance verification post-escrow, price sanity bounds, fail-closed compliance checks, reentrancy guards on every adapter call — and write unit tests specifically designed to catch a *deliberately buggy mock adapter* (e.g., one that under-delivers collateral, or returns an inconsistent price) to prove the engine catches it
- [ ] Implement `MarketFactory` with the full Validation Matrix (Section 6) as explicit, individually unit-tested rules — including negative tests confirming deployment reverts for each violation
- [ ] Implement `AdapterRegistry`: permissionless registration, `markVerified`/`markDeprecated` behind governance multisig, deprecation behavior (blocks new selection, does not pause existing markets, notifies affected LPs)

**Exit criteria:** the engine, factory, and registry are fully tested against mock/reference adapters that don't yet correspond to any real asset. This proves the architecture holds before any real money-handling logic (a real ERC20 transfer, a real Uniswap call) is introduced.

---

## Phase 2: Reference Adapters (Weeks 6–8)

Now implement the concrete, protocol-authored adapters that ship as the Verified defaults (PRD Section 3, Feature 2).

- [ ] `ERC20Adapter`, `ERC721Adapter` (Asset Adapters)
- [ ] `UniswapV3TWAPAdapter`, `ChainlinkAdapter` (Oracle Adapters — crypto path)
- [ ] `DEXSwapLiquidationAdapter`, `NFTAuctionLiquidationAdapter` (Liquidation Adapters — synchronous path)
- [ ] `StandardPositionAdapter`, `SoulboundPositionAdapter`, `TransferablePositionAdapter` (Position Adapters), including the transfer-hook-calls-compliance-adapter behavior required by the Validation Matrix
- [ ] Internal audit pass on all of the above; mark each `verified` in the Registry with an audit reference
- [ ] Integration tests: full loan lifecycle (origination → repayment, origination → grace → liquidation) using only reference adapters, on a testnet fork

**Exit criteria:** a market can be created, borrowed against, repaid, and liquidated end-to-end using exclusively Verified reference adapters, on testnet.

---

## Phase 3: Backend Infrastructure (Weeks 7–9, overlaps Phase 2)

- [ ] Event indexer covering all adapter-related events (`AdapterRegistered`, `AdapterVerified`, `AdapterDeprecated`) in addition to the original market/loan events
- [ ] **Position-transfer tracking**: indexer must listen for `Transfer` events on any `TransferablePositionAdapter`-based position NFT and resolve current holder for every subsequent query/alert — this is new relative to the original plan and must not be treated as a copy of the original fixed-borrower indexing logic
- [ ] Health monitoring service, updated to resolve current position holder (not original borrower) before calculating alerts for transferable-position markets
- [ ] Volatility/circuit-breaker monitoring service, now oracle-adapter-agnostic (reads `isTrusted` generically rather than assuming a specific oracle implementation)
- [ ] Liquidation bot/keeper: extended to handle the async path — detecting `LIQUIDATION_CURE` entries, tracking cure-window expiry, submitting `liquidate()` calls, and separately polling for settlement confirmation on `LIQUIDATION_SETTLING` loans, including the outer-timeout → manual-flag path
- [ ] Alert service (email/SMS/push), unchanged in mechanism from original plan but keyed to current position holder

---

## Phase 4: Frontend (Weeks 9–11, overlaps Phase 3)

- [ ] Market creation wizard rebuilt around adapter selection at each step (PRD Section 3, Feature 1) rather than the original fixed-parameter-only flow
- [ ] Adapter Registry public page (Verified/unverified/deprecated status, audit reference, TVL secured)
- [ ] Loan request flow updated with the pre-flight compliance eligibility check (before wallet approval prompt) and position-type disclosure at confirmation
- [ ] Health dashboard, updated for position-transfer-aware display
- [ ] RWA-market-specific UI: issuer risk-profile summary, dividend-handling disclosure, async-settlement-timeline display — all sourced from the maintained issuer reference data, not hardcoded per market

---

## Phase 5: RWA / Tokenized Equity Adapters (Weeks 10–13, gated)

This phase is explicitly **gated on legal/securities counsel sign-off**, not just engineering readiness — do not begin real (non-testnet) work here without that sign-off in place, per PRD Section 6.

- [ ] `ChainlinkEquityFeedAdapter`, including L2 sequencer-uptime verification and the 24/5 trading-window `isTrusted` logic
- [ ] `ERC3643ComplianceAdapter` (or equivalent for the specific first-integration issuer's compliance model)
- [ ] `IssuerRedemptionLiquidationAdapter`, including the async `isAsynchronous()`/`cureWindowSeconds()` behavior, built and tested against the specific first-integration issuer's actual redemption mechanics — this cannot be built generically before a specific issuer relationship is established
- [ ] Issuer-profile reference data pipeline (custody model, transfer restriction type, dividend-handling model) maintained and surfaced to frontend
- [ ] **Recommended integration order**: begin with an issuer offering freely-transferable, 1:1-custodied tokens with automatic on-chain corporate-action mirroring (lower integration risk, proves the architecture) before integrating an issuer with a more complex offshore/synthetic structure or unresolved dividend pass-through questions

**Exit criteria:** one live RWA market on testnet, exercising the full async liquidation path against a real (or realistically mocked) issuer redemption flow.

---

## Phase 6: Integration & Security Testing (Weeks 13–15)

- [ ] End-to-end scenario testing across every adapter combination actually shipping at launch (not just the happy path — include incompatible-combination rejection tests against the Validation Matrix)
- [ ] Deliberately adversarial adapter testing: a mock adapter that attempts to under-deliver collateral, return manipulated prices, or re-enter the engine during a call — confirming the Section 4 defensive invariants catch each case
- [ ] Async liquidation full-cycle testing: cure-window repayment, cure-window expiry, settlement confirmation, and settlement-timeout → manual-intervention-flag paths, all independently verified
- [ ] Load testing on the indexer's position-transfer-tracking path specifically, since this is new infrastructure relative to the original plan
- [ ] Internal security review of the adapter trust boundary as its own explicit review item, separate from general contract review

---

## Phase 7: Audit & Mainnet Prep (Weeks 15–17)

- [ ] External audit scope must explicitly include: the core engine's defensive-invariant enforcement against adapters, the Factory Validation Matrix, the async liquidation state machine, and each reference adapter individually — not just "the contracts" as an undifferentiated whole
- [ ] Address findings; re-audit critical-severity fixes
- [ ] Mainnet deployment, limited launch: crypto-native markets (ERC20/ERC721 reference adapters) first; RWA/equity markets held back until Phase 5's legal gate and a separate, additional audit pass specific to the RWA adapters are both complete
- [ ] Production infrastructure: RPC redundancy, monitoring, alerting — unchanged from original plan

---

## Phase 8: Launch & Iteration (Weeks 17+)

- [ ] Soft launch on crypto-native markets first
- [ ] RWA/equity market launch as a distinct, later milestone once its own audit and legal gates clear — explicitly not bundled into the same launch announcement as the crypto-native markets, to avoid implying the same risk profile
- [ ] Ongoing: expand the Verified adapter set based on real LP demand (new oracle sources, new liquidation mechanisms, additional issuer integrations) — each following the same Phase 2/5-style pattern of build → internal audit → mark Verified, rather than ad hoc additions to the core engine

---

## Team, Budget, and Risk Notes

Team structure, budget breakdown, and general technical/business risk tables from the original plan remain valid and are not restated here in full — the adapter architecture changes *what* gets built in which order, not the overall resourcing shape. Two additions worth calling out explicitly:

- **Add an explicit line item for the adapter internal-audit process** (Registry `markVerified` review) as an ongoing operational cost, not a one-time pre-launch expense — new adapters will be proposed continuously as new asset classes and issuers are supported.
- **Add issuer business-development/legal effort as its own tracked workstream** for Phase 5 — securing a specific RWA issuer's cooperation (compliance onboarding, redemption-channel access) is not fungible with engineering time and should not be scheduled as if it were.

---

## Deferred Roadmap (Post-v1)

Consistent with Technical Reference Section 19 and PRD Section 7:

- Reputation-based lending tiers, once a reliable on-chain reputation signal exists to build a native composite score against
- Agentic (AI-agent) borrower support
- Non-stablecoin lending assets (ETH/BTC), demand-gated
- Solana / non-EVM chain support, as its own architecture effort
- Cross-chain unified liquidity and position portability
- Autonomous adapter-verification agent, replacing or augmenting the human-governed `markVerified` process
