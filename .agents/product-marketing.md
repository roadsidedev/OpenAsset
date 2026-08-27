# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-08-27

Canonical source for all OpenAsset marketing work. Companion docs: execution playbook (`OpenAsset_Playbook_Mobile.docx`) and `docs/marketing/messaging-framework.md`. If a new claim does not trace here, update this file first.

## Product Overview
**One-liner:** OpenAsset lets anyone create an isolated lending market for almost any asset with measurable value.

**What it does:** Permissionless lending infrastructure. Anyone can launch a fully isolated market for a tokenized asset — crypto, NFTs, tokenized RWAs/equities — and choose collateral, oracle, compliance, and liquidation logic per market. No listing committee. No shared-pool contagion. The core engine does not hardcode what an asset “is”; it delegates custody, pricing, compliance, liquidation, and position representation to pluggable adapters.

**Product category:** Permissionless isolated lending infrastructure (not “a better Aave”). Shelf: DeFi lending / market-creation platform / adapter-extensible protocol.

**Product type:** On-chain protocol + app (EVM). Hybrid: marketplace of isolated markets × developer platform (adapters).

**Business model:** Protocol fees from market activity and/or market creation. Keep the model simple. Do not optimize revenue before useful activity exists. No token, no points program, no $OAM.

## Target Audience
**Target companies:** DAOs, NFT/gaming communities, RWA/tokenized-equity issuers, independent LPs, and Solidity developers who want to extend what can be borrowed against.

**Decision-makers:**
- Market creators / LPs (set terms, source liquidity)
- Adapter developers (extend asset coverage)
- Borrowers (use collateral they already hold)
- RWA/compliance partners (issuers, oracles, chains)

**Primary use case:** Launch or use an isolated lending market for an asset that Aave/Compound-style shared pools will not list — without inheriting someone else’s collateral risk.

**Jobs to be done:**
- Create a lending market for an asset I understand better than a listing committee
- Borrow against what I already hold without selling it
- Extend protocol coverage by writing an adapter, not by forking the core
- Contain risk if one collateral type fails

**Use cases:**
- Tokenized equity / Robinhood-style stock markets on Base (current proof surface)
- Long-tail ERC-20, gaming tokens, NFT collections
- RWA markets that need swappable compliance + session-aware pricing + issuer-redemption liquidation
- Hackathon / grant demos: create market → select adapters → borrow → show registry

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Market creator / LP | Custom terms, isolated risk, yield on unused assets | Shared pools reject their asset or infect them with others’ risk | Launch a market for an asset you understand; keep the yield; never inherit another market’s bad collateral |
| Adapter developer | Clean interfaces, no permission, fees/reputation later | Extending Aave-class protocols means waiting on governance or forking | Write to a Solidity interface; never touch the core; Verified mark + usage later |
| Borrower | Unlock liquidity without selling | Their asset is not on the approved list | Borrow against a gaming token, NFT, or tokenized stock without waiting for a listing vote |
| RWA issuer / compliance partner | Eligibility, session hours, issuer risk disclosure | Most DeFi lending was never built for permissioned assets | Compliance is a first-class swappable module, not a bolt-on |

## Problems & Pain Points
**Core problem:** Most lending protocols only accept a small, governance-approved list, and because they pool liquidity, one bad collateral decision puts every depositor at risk.

**Why alternatives fall short:**
- Shared-pool protocols (Aave, Compound) — listing is political; failure is contagious (April 2026 Aave/Kelp: $6.6B+ exited in 48 hours)
- NFT/RWA specialist lenders — vertical, not a platform others build on
- Fork-and-relist — still hardcoded asset logic; no adapter flywheel

**What it costs them:** Illiquid holdings, forced selling, governance lag, contagion risk, engineering time to rebuild cores for each new asset class.

**Emotional tension:** “My asset is valuable and I still can’t borrow against it — and if I put funds in a shared pool, someone else’s listing can blow me up.”

## Competitive Landscape
**Direct:** Isolated-market lending protocols (Morpho-style isolation, permissionless listing experiments) — often still crypto-native collateral, weaker adapter story, weaker RWA/compliance modules.
**Secondary:** Shared-pool majors (Aave, Compound) — depth and brand, but listing committees + shared risk. Do not compete as “better Aave.”
**Indirect:** CEXs, NFT-backed loans, RWA credit desks, just selling the asset.

**How we do it differently:** Five adapter interfaces (Asset, Oracle, Compliance, Liquidation, Position) + defensive invariants (engine verifies adapter reports) + market isolation so openness is survivable.

## Differentiation
**Key differentiators:**
- Isolated markets by construction
- Adapter-based asset logic (new class = new adapter, not core rewrite)
- Engine independently verifies adapter reports (balances, price sanity, fail-closed compliance)
- Liquidation adapters must return unused surplus
- RWA-ready modules exist (Chainlink tokenized equity feed, ERC-3643, async issuer-redemption with cure window) — say “architecture supports” until a given adapter is live

**How we do it differently:** Infrastructure other lending markets get built on (Shopify/AWS analogy), used only after the one-liner has landed.

**Why that’s better:** Coverage can grow faster than the core team; one market’s failure cannot drain the rest.

**Why customers choose us:** They need a market that does not exist on shared pools, or they need to *create* that market themselves.

## Objections
| Objection | Response |
|-----------|----------|
| “Isn’t this just Aave with extra steps?” | Aave is a product with a list. OpenAsset is infrastructure for isolated markets. We are not competing to be a better shared pool. |
| “Permissionless adapters = bigger attack surface.” | Isolation contains blast radius. The engine independently verifies every adapter call. Verification is a mark, not a solvency guarantee. |
| “Do you support every asset today?” | Architecture supports it via adapters. We do not chase categories without demand. “Almost any asset” — not “any asset.” |
| “Is it audited?” | Do not say audited unless a named audit exists. Say built for independent review. |
| “Who underwrites the RWA issuer?” | Not OpenAsset. Issuer/counterparty risk sits with whoever chose that collateral. We disclose it. |
| “Where is the token?” | There isn’t one. No $OAM, no points. Infrastructure-first. |

**Anti-persona:** Degens hunting leveraged farming on a shared pool; teams that need a token narrative to care; anyone who needs OpenAsset to guarantee off-chain issuer solvency.

## Switching Dynamics
**Push:** Listing wait, shared-pool contagion, forced selling of holdings that should be collateral.
**Pull:** Permissionless isolated market + adapters + RWA/compliance as modules.
**Habit:** Aave/Compound liquidity and brand; “lending = shared pool” mental model.
**Anxiety:** New protocol risk, unaudited adapters, “is this real or a hackathon toy?”

## Customer Language
**How they describe the problem:**
- “Only a small, governance-approved list”
- “One bad collateral decision puts every depositor at risk”
- “95% of assets excluded” (README — use carefully; do not imply we already cover 95%)

**How they describe us:**
- “Isolated lending market”
- “Anyone can create a market”
- “Adapters”

**Words to use:** isolated, permissionless, adapter, market creator, measurable value, almost any asset, architecture supports, Verified (as a mark, not a guarantee), non-custodial, EVM-first, stablecoin borrow (if asked).

**Words to avoid:** better Aave; adapter ecosystem (until a third-party adapter exists); marketplace (until usage is real); audited (until named); supports any asset (drop “almost”); $OAM / points / farming; we underwrite RWAs.

**Glossary:**
| Term | Meaning |
|------|---------|
| Isolated market | Own liquidity, collateral, and risk — no shared pool |
| Adapter | Swappable module for asset/oracle/compliance/liquidation/position |
| Verified | Review mark — not a solvency guarantee |
| Market creator | Person who deploys and configures a market |
| Defensive invariant | Core engine re-checks adapter reports |

## Brand Voice
**Tone:** Direct, technical-credible, founder-to-builder. No hype, no tokenomics lead.

**Style:** Concrete first (one-liner), insight second (infrastructure category). Say boundaries out loud. Dated proof over slogans.

**Personality:** Precise, honest, infrastructure-minded, allergic to overclaim.

**Voice rules (non-negotiable):**
- YES: one-liner verbatim for cold audiences; “architecture is built so…” for adapters today
- NO: “we have an adapter ecosystem”; “audited” without a named audit; token lead; issuer solvency guarantee
- Perception matches phase (see messaging framework §8)

## Proof Points
**Metrics:** North star = **active lending markets**. Secondary: verified adapters, external adapter developers, borrow volume, active borrowers/LPs, protocol fees. Most are pre-scale — do not invent traction.

**Customers:** None to claim as logos yet. First external adapter or first external market becomes the strongest proof the day it exists.

**Testimonials:** None yet. Do not fabricate.

**Value themes:**
| Theme | Proof |
|-------|-------|
| Isolated markets contain risk | April 2026 Aave/Kelp — $6.6B+ exited a shared pool in 48 hours after one collateral type failed |
| Core does not blindly trust adapters | Independent verification of balance deltas, price sanity, fail-closed compliance |
| Liquidation cannot take more than owed | Liquidation adapter interface requires unused surplus returned |
| New asset classes don’t require core rewrite | Five adapter interfaces; reference impls for ERC20, ERC721, Uniswap V3 TWAP, Chainlink, DEX-swap and NFT-auction liquidation |
| Built for tokenized RWA/equities | Chainlink tokenized equity feed (session-aware, sequencer-checked), ERC-3643 adapter, async issuer-redemption with cure window — purpose-built, not retrofitted. Say live vs architecture-ready honestly. |
| EVM live surface | Base and Robinhood-chain deployment work exists in-repo (see `docs/deployment-manifests/`) |

## Goals
**Business goal:** MVP → trusted protocol → first real markets → developer ecosystem → repeatable market creation → useful activity → sustainable fees.

**Conversion action (now):** (1) Create a market or (2) ship/submit an adapter. Borrow is the usage proof, not the top-of-funnel CTA for launch.

**Current metrics:** Not instrumented as a marketing funnel. Treat as unknown — see marketing plan §13.

## Changelog
- v1 (2026-08-27) — Initial context from execution playbook + messaging framework; locked one-liner, category reframe, scope, and “do not say” list for launch.
