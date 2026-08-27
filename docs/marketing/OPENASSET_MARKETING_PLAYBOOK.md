# OpenAsset — Marketing Plan v1

**Prepared by:** Max (COO), Roadside Lab
**For:** Founder / CEO
**Date:** 2026-08-27
**Status:** Draft v1 — for team review
**Sources:** Execution playbook, messaging framework, `.agents/product-marketing.md`, in-repo docs (Base/Robinhood manifests, adapter developer doc)

This plan is the *marketing* operating system. The execution playbook still governs what gets built. This document governs what we say, who we talk to, which channels we run, and what “launch soon” actually means. Messaging is locked in [messaging-framework.md](./messaging-framework.md). Do not invent a fourth version of the one-liner.

---

## 1. Executive summary

This plan optimizes for **trustworthy public launch of isolated market creation**, not for vanity reach. OpenAsset already has an MVP. The bottleneck is not “more features.” It is: (1) one coherent story across every surface, (2) a launch that is Simple / Lovable / Complete at a *chosen* scope, (3) a path from attention → adapter or market, without paid spend or a token.

**Bet 1 — Lock the story, then launch.** The messaging framework is already stronger than the README. Cold audiences get the one-liner: *OpenAsset lets anyone create an isolated lending market for almost any asset with measurable value.* Warm audiences get isolation vs shared-pool contagion. Deep audiences get the category reframe: *infrastructure other lending markets get built on* — never “a better Aave.” Launch marketing fails if README, site, Twitter, and grant copy drift. First 90 days spend founder attention on alignment and a demo that matches the claim, not on new slogans.

**Bet 2 — Acquire builders and market creators, not “DeFi users.”** Playbook Rule 3 (leverage) and Workstreams D/E/H say growth is adapter developers + market creators. Borrowers follow markets; they are not the launch ICP. Channels that fit a pre-seed, $0–$2K/mo, founder-led stack: X (build-in-public), hackathons/grants (Arbitrum Singapore, Base Batches, YZI — each with a *different* lead story), developer docs/quick start, public demo. Skip paid, skip token incentives, skip adapter-marketplace language.

**Bet 3 — Perception lags product on purpose.** The adapter flywheel is an *architectural* moat today, not a realized ecosystem. We say “the protocol is designed so a third-party adapter developer never has to touch the core.” We do **not** say “developers are building on OpenAsset” until one external adapter exists. The first external adapter is the single highest-leverage marketing asset of the next twelve months — more than any thread, grant, or landing-page rewrite.

**Twelve months, if we stay honest:** Public surfaces tell one story. A launchable SLC exists (create market → configure adapters → borrow against a live category, currently tokenized stocks on Base as the proof surface). At least one external adapter or external market exists as a named proof. Hackathon/grant pipeline is converting contacts, not just badges. North star (active lending markets) is instrumented. Revenue is tracked, not optimized. Still no token.

**90-day priorities**
1. Align README, site, docs, Twitter bio, and grant boilerplate to the messaging framework (`copywriting`, `product-marketing`).
2. SLC launch gate: one complete create-market path that a stranger can demo (`launch`, `onboarding`).
3. Public demo + architecture diagram + 10-step hackathon flow (`launch`, `sales-enablement`).
4. Adapter quick start that an external dev can finish without the founder (`product-marketing` for claims; docs are product).
5. Weekly founder update on X — built, tested, learned, next (`social`).
6. Hackathon/grant pack + lead capture so booth conversations become adapter attempts (`events`, `public-relations`).

---

## 2. Strategic frame

### What OpenAsset is, in one sentence
OpenAsset lets anyone create an isolated lending market for almost any asset with measurable value.

### The category we're claiming
We are **not** competing in “DeFi lending protocols” as Aave defines it. We are claiming **permissionless isolated-market infrastructure** — Shopify for lending markets, not “a nicer store.” Use the category reframe only after the one-liner has done its job. Source: founder framing in the messaging framework; playbook long-term goal (“open infrastructure for permissionless lending market creation”).

### Who we're for (ICP, distilled)
- **Market creators / LPs** who control or source liquidity and need custom risk, pricing, liquidation, or compliance for an asset a listing committee will not touch.
- **Adapter developers** who can write to a Solidity interface and do not want to wait on someone else’s roadmap.
- **Borrowers** (secondary at launch) who hold gaming tokens, NFTs, or tokenized stocks and do not want to sell them.
- **RWA / compliance partners** who need eligibility and session-aware pricing as modules, not bolt-ons.
- **Real problem vs stated problem:** Stated = “support more assets.” Real = “shared pools make listing political and failure contagious; specialists are verticals, not platforms.”
- **What they’re buying:** The right to *create* a market and contain its risk — not a yield farm.

### The business model logic
Fees on market activity and/or market creation. Simple on purpose. Do not optimize take-rate before useful activity (playbook §19). No token, no points — leading with tokenomics would undercut infrastructure positioning.

**Unit-economics theory (pre-data):** CAC is founder time + hackathon travel + content, not ads. “Customer” at this stage is a market creator or adapter developer. LTV is protocol fees over the life of markets that person enables — unknown until activity exists. Do not pretend CAC is known.

**Compounding channel thesis:** Developer docs + public adapters + hackathon alumni + build-in-public X. One well-made asset (adapter quick start, isolation explainer, demo video) should rank, seed social, arm grant apps, and become the booth talk.

### Market-quality gate
**Large problem × low-to-medium frequency.** Creating a lending market or unlocking a stuck asset is high-stakes and infrequent. That means expensive to stay top-of-mind, long consideration, retargeting-heavy *if* we ever buy ads. The plan therefore compounds via **builders and proof**, not weekly consumer ads. Named in §13 so we don’t paper over it.

### Brand voice (the non-negotiable)
From `.agents/product-marketing.md` and the messaging framework:

| YES | NO |
|---|---|
| One-liner verbatim for cold audiences | “Better Aave” |
| “Architecture supports…” / “designed so…” | “Adapter ecosystem” / “marketplace” until third-party proof |
| Isolated, permissionless, measurable value, almost any asset | “Supports any asset” (dropping *almost*) |
| Named, dated proof (Aave/Kelp April 2026) | “Audited” without a named audit |
| Issuer risk disclosed | “We underwrite RWAs” |
| Stablecoin borrow as a boundary if asked | $OAM, points, farming |

Tone: direct, technical-credible, allergic to overclaim. Every other section of this plan respects these rules.

---

## 3. Current state

*Scored from materials, 2026-08-27. Push back where you have better data.*

### Team composition (marketing surface area)

| Person | Role | Marketing surface area |
|---|---|---|
| Founder / CEO | Product, protocol risk, demos, partnerships, grants | Final voice, booth, Twitter, grant narrative |
| Max (COO / Hermes) | Orchestration, drafts, research, ops | Plans, copy drafts, skill-driven execution, tracking |
| (none) | Dedicated marketer | Gap. First hire is **not** this quarter. First hire later: π-shaped Product Marketing + Growth, titled Lead/Manager — not VP/CMO. |

### Marketing budget (current)
- Paid acquisition: **$0/mo** (playbook: do not run large paid campaigns yet)
- Tooling: GitHub, Vercel/hosting, SendGrid/Twilio already in stack for product — not a marketing stack
- Retainers / agency: none
- Headcount: founder time
- Blended CAC: **unknown** (highest-impact open decision, §13)
- % of ARR: N/A — protocol fees not yet a marketing-relevant ARR figure
- **Funding-stage tier:** Pre-seed / bootstrapped ($0–$2K/mo organic). 90-day plan must work **without** paid unlocks.

### Phase of growth
Not SaaS ARR. Closest analogue: **$0–10K “grueling”** — product exists, distribution does not. Binding constraint: **trust + first external usage**, not spend. Growth pattern: linear founder-led until a step-function (first external adapter, first active market cluster, or a grant/hackathon win with a named builder).

### What's already done

| Asset | Status | Marketing leverage |
|---|---|---|
| MVP: permissionless isolated markets, adapters, registry, fees | Built | Launchable *if* UX/trust bar is met |
| Messaging framework | Strong internal doc | Canonical copy — currently not on public surfaces |
| Execution playbook | Strong internal OS | Sequencing; not public |
| Adapter developer doc | In-repo (`docs/ADAPTER_DEVELOPER.md`) | DevRel seed |
| Base + Robinhood deployment manifests | In-repo | Proof of EVM/RWA surface — do not overclaim liveness |
| Tokenized stocks work on Base | In-repo docs + recent commits | Best *current* demo category |
| README / product copy | Live, **drifts** from messaging framework | Must be rewritten before launch |
| Notifications stack (SendGrid, Twilio, FCM) | Product infra | Later lifecycle; not launch-critical |

### What's in-flight

| Item | Status | Blocker |
|---|---|---|
| Public launch | “Soon” | Messaging not on surfaces; SLC gate not formally signed |
| Hackathon pack (Arbitrum SG, Base Batches, YZI) | Partial (messaging names angles) | Program-specific research incomplete for Base + YZI |
| Adapter SDK / quick start as *external* path | Playbook P0 | Product work, not a copy problem |
| Brand naming | Mixed: OpenAsset / Open Asset / oA Market | Decision |

### What's stuck

| Issue | Cost of inaction | Action |
|---|---|---|
| Four slightly-different “what we are” texts | Credibility death in front of a judge | One framework, all surfaces |
| No external adapter to point at | Moat stays theoretical | Hackathon bounty + quick start |
| README overclaim (“any asset”, Aave comparison as identity) | First GitHub visitor gets the wrong category | Rewrite to one-liner + isolation |
| Metrics not reviewed weekly as a growth system | Can’t tell if launch worked | Instrument north star + sources |
| Grant/hackathon contacts with no CRM | Booth becomes theater | Simple lead sheet (playbook E2) |

### Audit rubric snapshot

| # | Section | Score | Note |
|---|---|---|---|
| 1 | Positioning | 4 | Framework is distinctive; surfaces not aligned |
| 2 | Customer research | 1 | Founder intuition + personas; no VOC transcripts |
| 3 | Homepage | 2 | App exists; not clearly voice-locked to framework |
| 4 | Sales / product pages | 1 | No public docs site narrative at framework quality |
| 5 | Conversion pages | 1 | No grant/hackathon/creator landing variants |
| 6 | Competitor comparison | 1 | Isolation vs Aave is in the *framework*, not a public page (and should not be “vs Aave” SEO bait yet) |
| 7 | Resources / content | 1 | No public content engine; playbook F pillars unused |
| 8 | Onboarding | 2 | Market creation UX is a P0 product ticket, not a tested flow |
| 9 | Email lifecycle | 1 | SendGrid exists; no marketing lifecycle |
| 10 | Sales material | 2 | Pitch/demo implied by playbook E1; not a kit |
| 11 | Messaging | 4 | Documented and strong internally; not operationalized |
| 12 | Pricing | 2 | Fee model direction only; not packaged |
| 13 | CRO | 0 | No tests, no funnel instrumentation |
| 14 | GTM launches | 1 | No structured public launch yet |
| 15 | Ads (paid) | 0 | Correct for stage — not a failure |
| 16 | SEO | 0 | New / low-authority; brand-only if anything |
| 17 | Internationalization | 0 | Correct for stage (hackathons are distribution, not i18n) |

**Total: 23 / 85 (27%).** Shape: **strong voice / weak distribution** plus **strong product, weak everything-else**. The gap this plan closes is Acquisition (honest channels) + Activation (SLC market-create path) — not ads, not SEO scale, not a referral program.

---

## 4. Acquisition

How strangers become aware. Stage rule: **audition, not auction.** We earn technical attention; we do not buy a captive DeFi audience.

### Current state
No compounding acquisition engine. GitHub + whatever founder posts. Hackathons named, not yet run as a conversion system. README currently teaches the *wrong* category (Aave-alternative, “any asset”).

### The plan

**Move 1 — Surface alignment (Now).** Rewrite README, app chrome, Twitter/X bio, and docs intro from the messaging framework. Skill: `copywriting`, `copy-editing`, `product-marketing`. This is acquisition because the first sentence a builder reads *is* the ad.

**Move 2 — Founder-led X (Now).** One rented channel. Cadence: weekly founder update (built / tested / learned / next) plus opportunistic proof (new adapter, new market, security milestone). Funnel every thread to docs or demo — not to “follow for token.” Skill: `social`. Kill criterion: 4 weeks with no profile visits to docs/demo and no DMs from builders → change format, don’t just post more.

**Move 3 — Public demo (Now).** 60–90s: create market → pick collateral → pick adapters → deploy → borrow sketch → registry “you can write this.” Matches playbook E1. Skill: `video`, `launch`. Host on owned page + X.

**Move 4 — Hackathons as the borrowed channel (Now).** Not “win the prize.” Convert attendees into adapter attempts (E2/E3). Lead story by program: Arbitrum SG → tokenized equity / RWA + Kelp proof; Base Batches → adapter-as-platform unless research says otherwise; YZI → research first (open decision). Skill: `events`, `competition-marketing`, `public-relations`.

**Move 5 — Grants as packaging, not as the business (Now, selective).** Reusable grant pack (K1): description, architecture, traction (honest), roadmap, metrics. Skill: `public-relations`, `product-marketing`. Do not spray every bounty.

**Move 6 — SEO / comparison pages (Q2+).** Isolation explainer and “how isolated lending differs from shared pools” can exist as *education*, not “OpenAsset vs Aave” conquest SEO until we have usage. Skill: `seo-audit`, `ai-seo`, `content-strategy`. Skip programmatic SEO this year.

**Move 7 — Paid (Skip until funding unlocks).** Playbook §28. When a seed-close paid test exists ($5–15K/mo), first tests are developer/intent search and maybe Twitter — never Meta prospecting into “yield.” Skill: `ads` (later).

**Move 8 — Directory / review sites (light Now).** Only where crypto builders actually look (hackathon lists, Ecosystem pages). Skill: `directory-submissions`. No spray.

### 90-day acquisition moves
- W1–2: README + bio + one-pager from framework; demo scriptboard
- W3–4: Demo cut; hackathon pack v1; lead sheet
- W5–8: Weekly X live; first program-specific narrative (Arbitrum or Base, whichever is next on the calendar)
- W9–12: First “proof” content if an adapter/market exists; otherwise publish the isolation explainer without ecosystem claims

### 12-month outlook
- Q1: Story locked; launch + hackathon presence
- Q2: Docs/SEO seed; first named external builder story
- Q3: Repeatable builder content; partnerships that reduce friction (oracles, issuers, chains) — only if “what does this make easier?” is clear
- Q4: Category-reframe content *if* repeatable external adapters exist; else stay on architecture language

### Skills + tools
- **Skills:** `copywriting`, `social`, `video`, `launch`, `events`, `public-relations`, `content-strategy`, `seo-audit` (Q2), `directory-submissions`
- **Tools:** GitHub, X, static docs/site, simple spreadsheet or Linear for leads. No GA4/Ahrefs required in Q1.

---

## 5. Activation

Once someone tries us, do they have an experience that converts? Conversion ≠ signup email. Conversion = **created a market** or **ran the adapter template**.

### Current state
Market creation is powerful and still too founder-shaped (playbook A3). Adapter path is documented for insiders more than for a stranger (D1/D2). Wallet-first app, no classical SaaS onboarding emails.

### SLC launch gate (`launch` skill)
- **Simple:** One job — create an isolated lending market for a supported collateral class.
- **Lovable:** A target creator would *choose* it over begging a listing committee.
- **Complete:** Configure terms, see adapter verification status, review, deploy, see the market. No “coming soon” holes in that path.
- If we are still adding asset classes to the *launch promise*, we are in “just one more feature.” Cut scope. Tokenized stocks / Base proof surface is enough to launch *that* job.

### The plan

**Move 1 — Market-create UX that explains itself (Now).** Every setting has a sentence. Risk warnings on LTV/liquidation. Adapter verification status visible. Review-before-deploy. Skill: `onboarding`, `copywriting`. Product ticket A3 is marketing-critical.

**Move 2 — Two activation tracks (Now).**
- Creator: template “example market” + checklist (H3).
- Developer: Read → install → copy template → modify → test → submit (D2). Time-to-first-adapter is the activation metric.

**Move 3 — Demo that is the onboarding (Now).** Booth QR / docs CTA goes to the same path a user can repeat. Skill: `launch`.

**Move 4 — Email (hold).** SendGrid is in the stack. Do **not** build a five-email lifecycle until the UI path is stable (`emails` skill: onboarding emails when UI is stable). One transactional “market deployed” email is enough in Q1.

**Move 5 — Concierge for first 10 creators/devs (Now, high-touch).** Founder time, on purpose. Skill: conceptually `onboarding` (concierge). Kill when the quick start works without you.

### 90-day / 12-month
- 90 days: a stranger can complete create-market on the launch collateral class; a developer can complete template adapter locally.
- 12 months: time-to-first-adapter and time-to-first-market measured; verification turnaround published; still no fake “marketplace.”

### Skills + tools
`onboarding`, `signup` (wallet connect, not email/password), `copywriting`, `launch`. Tools: existing app + docs. No paywall skill — this is not a freemium app.

---

## 6. Retention

Do they stay and deepen? For a protocol, retention is **returning creators, returning borrowers, returning adapter developers** — not DAU vanity.

### Current state
No lifecycle. Product notifications exist for protocol events (health, volatility) — keep those as product, not marketing spam.

### The plan

**Move 1 — Changelog as retention (Q2).** Playbook F5 / idea #108. Signal the protocol is alive without empty announcements. Skill: `social`, `copywriting`.

**Move 2 — Contributor recognition (Q2, light).** Contributor → Verified adapter developer. Do not invent governance (G3). Skill: `community-marketing` only as builder community, not “Discord engagement farming.”

**Move 3 — Support as marketing (Q2).** Every stuck SDK question becomes a doc ticket (D4). Skill: conceptually support-as-marketing (#135).

**Move 4 — Win-back (Skip Q1).** No ghosted SaaS trial to revive. If a creator deployed a dead market, the product problem is liquidity/discovery (A4, Phase 5) — not an email.

**Move 5 — Do not retain with incentives.** Playbook I3: no significant liquidity mining before demand. Token farming would retain the wrong people.

### Skills + tools
`churn-prevention` is mostly N/A (no subscription cancel flow). Use `emails` later for “new adapter in your market category.” Tools: GitHub issues + weekly review.

---

## 7. Referral

Do retained users bring more users?

### Current state
None. Do not bolt on an affiliate program for a protocol with no usage.

### The plan

**Move 1 — Founder as referrer-zero (Now).** Intros to issuers, oracle people, hackathon teammates. Skill: `co-marketing` only when “what does this make easier?” is crisp (playbook §17).

**Move 2 — Hackathon alumni loop (Now).** E3 within one week: SDK, bounty, community invite. That *is* the referral mechanic for builders.

**Move 3 — Two-sided later (Q3+).** Creators invite borrowers; adapter devs invite creators. Only after one side exists. Skill: `referrals` (two-sided). Idea #137.

**Move 4 — Affiliates / lifetime deals (Skip).** Off-brand. No AppSumo. No “invite 3 friends for points.”

### Skills + tools
`referrals` (later), `community-marketing` (builders only), `co-marketing`. Tool: lead sheet.

---

## 8. Revenue

What we charge, who pays, how it compounds.

### Current state
Direction: protocol fees on activity or creation. Track markets, volume, fees, revenue per market, revenue by asset type. **Do not optimize before useful activity.**

### Unit economics

| Metric | Value | Note |
|---|---|---|
| ARPC | Unknown | No stable fee base |
| Blended CAC | Unknown | Founder time not costed |
| Annual retention | Unknown | |
| LTV | Unknown | |
| LTV / CAC | Unknown | Do not forecast revenue from these |

### The plan

**Move 1 — Instrument fees, don’t tweak them (Now).** Skill: `analytics` (product analytics, not GA theater), `revops` only as “define the event.”

**Move 2 — No pricing page theater (Now).** A DeFi fee is a protocol parameter, not a SaaS grid. Sales material explains *isolation and adapters*, not “Pro vs Enterprise.”

**Move 3 — Grants ≠ revenue (Now).** Acceleration capital only.

**Move 4 — Incentives (Q4+, evidence-gated).** Only after a category shows organic demand.

### Skills + tools
`pricing` (when fee packaging is a real decision), `sales-enablement` (grant/hackathon kit, not AE deck), `analytics`. No `paywalls`.

---

## 9. 90-day roadmap

Owners: **F** = Founder, **M** = Max/COO (Hermes + marketing skills). Product tickets stay on the execution board.

### Weeks 1–2 — Unblock

| Move | Stage | Owner |
|---|---|---|
| Lock naming: **OpenAsset** publicly (retire “Open Asset” / “oA Market” drift) | Cross-cut | F |
| Rewrite README + X bio + app one-liner to framework | Acquisition | M draft / F ship |
| SLC gate sign-off: which collateral path is launch-complete | Activation | F |
| Inventory live vs architecture-ready adapters (honest table) | Acquisition | F + M |
| Stand up lead sheet (hackathon/dev/creator) | Acquisition | M |
| Weekly metrics skeleton (north star + sources) | Revenue | M |

### Weeks 3–4 — Foundation

| Move | Stage | Owner |
|---|---|---|
| Demo video v1 (E1 ten steps, cut to 90s) | Acquisition | F on camera / M script |
| Hackathon/grant one-pager + architecture diagram | Acquisition | M |
| Market-create microcopy pass (warnings, verification, review) | Activation | M + F |
| Adapter quick-start test with *one* external person | Activation | F |
| Isolation explainer draft (education, not vs-Aave SEO) | Acquisition | M |
| Research Base Batches + YZI theses before writing those apps | Acquisition | M |

### Weeks 5–8 — Velocity

| Move | Stage | Owner |
|---|---|---|
| Weekly X update live (4 weeks) | Acquisition | F |
| Next calendar hackathon/grant submitted with *program-specific* lead | Acquisition | F + M |
| Bounty list (3 adapter needs, spec + acceptance) | Acquisition / Referral | F |
| Post-event follow-up SLA: 7 days | Referral | M tracks / F sends |
| Changelog started (even if internal-first) | Retention | M |
| Kill empty announcements; only ship-proof posts | Acquisition | F |

### Weeks 9–12 — Compound

| Move | Stage | Owner |
|---|---|---|
| Public launch of the SLC path (if gate passed) | Activation | F |
| If external adapter exists: named proof post + framework §8 upgrade | Acquisition | F + M |
| If not: do **not** fake ecosystem; publish architecture + ask | Acquisition | F |
| 90-day review: which channel produced *useful* users | Cross-cut | F + M |
| Decide Q2: docs/SEO vs more hackathons vs partner (one, not three) | Acquisition | F |

---

## 10. 12-month outlook

**Budget method:** Cannot run Method 1 (5–40% of ARR) or Method 2 (goal-based CAC math) — ARR and CAC are unknown. **Interim rule:** stay in **pre-seed organic** ($0–$2K/mo). Experimental buffer = founder time (10% of weeks on a new channel), not cash.

**Annual cash marketing budget:** ~$0–$24K worst-case travel/hackathon, not media. Do not put $50K ads on a slide.

**End-of-year outcome (honest, not a guarantee):** Story consistent; SLC launched; ≥1 external adapter **or** a documented reason why not; north star instrumented; fees observed; still no token.

**Growth pattern:** Linear founder-led with **one attempted step-function** (first external builder). 70/20/10: 70% story + demo + hackathon conversion, 20% adapter DX, 10% experiments (directory, one partner, light SEO).

#### Q1 — Months 1–3
**Funding state:** Pre-seed / bootstrapped
**Focus:** Launch the story and the SLC path; convert one borrowed-channel program into builder attempts.
**Outcomes:** Surfaces aligned; demo live; weekly X; lead sheet; one program-specific application; SLC shipped or explicitly delayed with a product reason.
**KPI targets:** Messaging audit 100% of public surfaces; ≥4 weekly updates; ≥10 qualified leads; ≥1 external adapter *attempt*; active markets counted (even if low).
**S-curves:** Channel = X + hackathons (growing). Product = market-create (must complete). Market = tokenized stocks/Base as proof, not “all RWAs.”

#### Q2 — Months 4–6
**Funding state:** Still organic unless a grant lands (grant ≠ seed close).
**Focus:** Repeatability — attention → adapter → market.
**Outcomes:** Quick start works unattended; bounty system; first named external story *or* honest stall; isolation explainer published; partner pipeline started only with friction-reducing targets.
**KPI targets:** Time-to-first-adapter measured; ≥1 verified *external* adapter or 3 documented failures that turned into product tickets; returning developers > 0.
**S-curves:** Stage next curve (docs/SEO or a single partner class) while hackathons still run. Do not start adapter marketplace.

#### Q3 — Months 7–9
**Funding state:** If seed-close ($5–15K/mo test budget) — *then* consider tiny paid tests to builder-intent queries. If not, stay organic.
**Focus:** Strongest asset category by evidence (playbook days 61–90).
**Outcomes:** Discovery UX if markets exist to discover; creator campaign around the winning category; still no token.
**KPI targets:** Active markets up vs Q2; borrow volume on *some* market > 0 without founder as the borrower; one case-study.
**S-curves:** Double down on the category that moved; pause the rest (Rule 6).

#### Q4 — Months 10–12
**Funding state:** Revisit. Series-A-style spend is fantasy here.
**Focus:** Either the category reframe is *earned* (repeatable external adapters) or we stay in architecture language another year — both are acceptable; lying is not.
**Outcomes:** Contributor recognition; grant pack with *real* traction numbers; decision on marketplace still gated on usage.
**KPI targets:** North star trend; fees observed; CAC still may be unknown — then it stays in §13 rather than invented.
**S-curves:** If hackathons plateau, 20% budget (time) already sitting on docs/partner curve should be ready.

---

## 11. Marketing operations stack

### The thesis
Founder + COO agent + the marketing-skills library can output the work of a small crypto marketing team **if** we do not pretend to run 12 channels. Strategy stays in-house (founder voice). Execution drafts (README, threads, grant answers, demo script, plan updates) run through Hermes skills. Product/security never get outsourced to a growth agency.

### Skills mapped to AARRR

| Stage | Primary skills | Supporting skills |
|---|---|---|
| Acquisition | `social`, `launch`, `events`, `copywriting`, `public-relations` | `video`, `content-strategy`, `directory-submissions`, `seo-audit` (Q2) |
| Activation | `onboarding`, `copywriting`, `launch` | `signup` |
| Retention | `copywriting` (changelog) | `community-marketing` (builders), `emails` (later) |
| Referral | `co-marketing`, `events` (alumni) | `referrals` (Q3+) |
| Revenue | `analytics`, `product-marketing` | `pricing` (later), `sales-enablement` |
| Cross-cutting | `product-marketing`, `marketing-plan`, `copy-editing`, `marketing-psychology` | `competitors` (only as isolation education), `marketing-ideas` |

### MCPs / APIs

| Stage | Existing | This quarter |
|---|---|---|
| Acquisition | GitHub, X (manual) | Lead sheet; no Ahrefs required |
| Activation | App + docs | Same |
| Retention | SendGrid (product) | Do not hijack for drips yet |
| Revenue | Protocol events / backend | Count markets, volume, fees weekly |

Concrete example: this plan itself is the stack working — `product-marketing` locked claims, `launch` imposed the SLC gate, `marketing-plan` sequenced AARRR against a $0 paid budget, `copywriting` will rewrite README from the same source.

### Capability unlocks

| Stage | Headcount | Tooling | Channels live |
|---|---|---|---|
| Now (pre-seed) | Founder + Max | GitHub, X, docs, lead sheet | X, hackathons, grants, demo |
| Grant win | Same | Travel, maybe design contractor | Same + better production |
| Seed close | First marketing **Lead** (π: PMM + Growth), not VP | Lightweight analytics | Add intent-search tests |
| Later | Still no 15-person brand org | — | Paid only with unit economics |

### Team and agency model

| Function | Owned by | Executed by |
|---|---|---|
| Growth (demand) | Founder | Max drafts; founder ships on X/booth |
| Product marketing (story) | Founder | Max maintains `.agents/product-marketing.md` |
| Content (trust) | Founder | Max drafts; no content farm |

---

## 12. Tactical idea bank

Sections 4–8 are what we **do**. This is the inventory of what’s **possible** (139 ideas from `marketing-ideas`), filtered for a pre-seed lending protocol with no token and a technical voice.

**Legend:** Now (Q1) · Q2 · Q3+ · Q4+ · Skip

### 12.1 Now (Q1)

| # | Idea | Note |
|---|---|---|
| 5 | Content repurposing | Demo → thread → grant paragraph → booth |
| 12 | Marketing jiu-jitsu | Isolation vs shared-pool *idea*, not attack ads |
| 37 | Reddit keyword research | Listen for “can’t list this asset” language — don’t spam |
| 41 | X audience | The rented channel |
| 59 | Article quotes / HARO-style | Only if a reporter asks about isolated lending / RWA |
| 70 | Conference speaking | Hackathons *are* the speaking circuit |
| 74 | Press coverage | Only with a real proof (external adapter, not “we launched”) |
| 79 | Early-access referrals | High-touch first 10 builders |
| 109 | Public demos | E1, non-negotiable |
| 114 | Moneyball marketing | Weekly: what actually produced a builder |
| 117 | Product competitions | Hackathon bounties |
| 123 | Open source as marketing | Contracts + adapter templates |
| 129 | Review sites | Selective ecosystem directories only |
| 133 | Investor marketing | Grant pack; not a token roadshow |
| 136 | Developer relations | The actual job |
| 139 | Customer language | Capture booth phrases into product-marketing.md |

### 12.2 Q2

| # | Idea | Note |
|---|---|---|
| 1–2 | Easy keywords / SEO audit | Isolation explainer, docs |
| 3 | Glossary | Adapter, isolated market, Verified |
| 6 | Proprietary data | Only if we have market/adapter stats worth publishing |
| 7 | Internal linking | Docs |
| 11 | Competitor comparison | “Isolated vs shared pool” education — not “vs Aave” conquest |
| 35 | Community marketing | Builder Discord/Telegram, not engagement farming |
| 38 | Reddit marketing | Value-first, after listening |
| 49 | Newsletter | Only after a list exists from leads |
| 64 | Community sponsorship | Tiny, targeted |
| 65 | Live webinars | Adapter office hours |
| 101 | Industry interviews | Oracle/issuer people |
| 102 | Social screenshots | Demo, not memes |
| 108 | Changelogs | Retention signal |
| 115 | Curation | Adapter/template roundups |

### 12.3 Q3+

| # | Idea | Note |
|---|---|---|
| 4 | Programmatic SEO | Skip until data/templates exist — likely Q4+ |
| 8–9 | Refresh / KB SEO | After a real docs corpus |
| 14–15, 22 | Side projects, engineering as marketing, public APIs | Adapter SDK *is* the free tool |
| 39 | LinkedIn | Secondary; X stays primary |
| 42 | Short-form video | Recut demo |
| 54, 57–58, 61, 63 | Partnerships / integrations | Only friction-reducing (playbook §17) |
| 66, 68–69, 72 | Events scale | After Q1 proves conversion |
| 78, 82 | Product Hunt / alternatives | Optional at a *product* GA, not a protocol MVP tweet |
| 87 | Powered-by | If markets want the badge |
| 95 | Concierge | Keep for RWA issuers |
| 98 | Templates | Market + adapter templates as marketing |
| 100 | Promo videos | Second-generation demo |
| 103, 107, 126–127, 130, 138 | Courses, podcasts, YouTube, live audio, podcast tours | Only if founder bandwidth; default skip until Q4 |
| 111 | Challenges | Adapter bounty seasons |
| 125 | App marketplaces | N/A unless a wallet/app store listing matters |
| 134 | Certifications | Verified developer — light version |
| 135 | Support as marketing | Docs from repeated pain |
| 137 | Two-sided referrals | After both sides exist |

### 12.4 Q4+ / long-game

| # | Idea | Note |
|---|---|---|
| 16–21, 19 | Importers, quizzes, calculators, Chrome ext, microsites, scanners | Mostly off-category |
| 23–34 | All paid ads | Funding unlock only |
| 40 | Instagram | Wrong ICP |
| 55–56, 60 | Influencer whitelist, resellers, pixel sharing | No |
| 67, 71, 73, 76 | Roadshows, own conferences, media acquisitions, documentaries | Fantasy scale |
| 75 | Fundraising PR | When a round actually closes |
| 104–106, 110 | Book, annual report, EOY wrap, awards | After there is a year of *usage* |
| 116 | Grants as marketing | We *use* grants; don’t become a grant influencer |
| 119–121 | OOH, stunts, guerrilla | Off-voice |
| 131–132 | Internationalization / price localization | Hackathons ≠ i18n |
| 84–85 | Giveaways | No |

### 12.5 Skip / off-brand (with rationale)

| # | Idea | Why skip |
|---|---|---|
| 43 | Engagement pods | Fake social proof |
| 77, 80–81, 83, 86 | Black Friday, NY promo, early-access pricing theater, Twitter giveaways, **lifetime deals** | Token/coupon energy; wrecks infrastructure positioning |
| 88–89 | Free migrations / contract buyouts | Not a SaaS switcher motion |
| 91 | In-app upsells | No seats/plans |
| 99, 112, 118, 122 | Graphic novel, reality TV, Cameo, humor-as-default | Wrong voice |
| 113, 120 | Controversy / stunts | Credibility product |
| 124 | ASO | Not an app-store consumer product |

### Idea-bank summary
- Acquisition-heavy by design (protocol pre-usage).
- Activation = market-create + adapter quick start, not email capture.
- Retention/referral/revenue ideas mostly **deferred** until activity exists.
- **Skipped** the coupon/giveaway/lifetime-deal cluster on purpose — that is the plan protecting the brand, not a lack of imagination.
- Coverage is a **small %** of the 139-idea surface. Appropriate for 27/85 current-state score. The bank is the inventory to scale later without losing the story.

---

## 13. Measurement, RACI, open decisions, appendix

### Measurement

**North star:** **Active lending markets** (playbook §20). Not followers. Not TVL if TVL is founder-seeded.

**Leading indicators**

| Stage | Leading indicators |
|---|---|
| Acquisition | Profile→docs/demo clicks; hackathon leads; grant submitted; weekly update shipped (yes/no) |
| Activation | Markets created; adapter template clones; time-to-first-adapter; time-to-first-market |
| Retention | Returning creators/devs; changelog hits |
| Referral | Alumni who attempt an adapter within 7 days of event |
| Revenue | Borrow volume, fees, revenue by market — observe only |

**Cadence**
- **Weekly** (playbook §21): product, security, developers, markets, growth source, fees, founder time. F + M.
- **Monthly:** messaging drift check (any new copy that doesn’t trace to the framework?).
- **Quarterly:** recalibrate this plan; promote perception-roadmap row only when proof exists.

### RACI

| Domain | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Strategic plan | M | F | — | — |
| Brand voice / claims | M drafts | F | — | Public |
| README / site copy | M | F | — | Users |
| Launch go / no-go | F | F | M | — |
| X / demo | F | F | M | — |
| Hackathon/grant narrative | M | F | — | Programs |
| Adapter DX | F (product) | F | M (claims) | Devs |
| Pricing/fees | F | F | M | — |
| Paid spend | — | F | M | Nobody until unlocked |
| Future marketing hire | F | F | M | — |

### Open decisions (ranked)

1. **CAC / any acquisition cost accounting** — every revenue projection is blocked. Impact: §8 and §10 stay qualitative until we cost founder time or get a fee baseline.
2. **SLC launch scope** — which collateral path is *complete* enough to launch without “and NFTs and all RWAs.” Impact: launch date and demo.
3. **Public liveness claims** — Base / Robinhood manifests exist; what is safe to say is *live* vs *deployed* vs *architecture-ready*. Impact: every grant sentence.
4. **Naming** — OpenAsset vs Open Asset vs oA Market. Impact: SEO, bio, grants.
5. **Next program on the calendar** — Arbitrum SG vs Base Batches vs YZI timing. Impact: which lead story ships first. Base + YZI theses still under-researched.
6. **Audit status** — is there a named review we can cite? If no, language stays “designed for independent review.”
7. **First external developer candidate** — who is the one person for the Week 3–4 quick-start test.
8. **Budget reality** — confirm $0 paid is intended (plan assumes yes).
9. **Community surface** — Discord vs Telegram vs GitHub-only for builders.
10. **When (if ever) Product Hunt** — default: not Q1.

### Appendix

**In this repo**
- `.agents/product-marketing.md` — context every marketing skill should read first
- `docs/marketing/messaging-framework.md` — claims, moat, do-not-say, perception roadmap
- `docs/marketing/OPENASSET_MARKETING_PLAYBOOK.md` — this file
- `docs/ADAPTER_DEVELOPER.md` — DevRel seed
- `docs/deployment-manifests/` — Base + Robinhood — check before any “live on X” sentence
- Execution playbook (founder working doc) — build order, flywheels, 30/60/90, Rule 6

**Working files (skill layout)**
- `~/marketing-plans/openasset/` — research, progress, copy of final plan

---

*OpenAsset Marketing Plan v1. Prepared by Max (COO), 2026-08-27. For team review. Interactive section-by-section REVIEW was collapsed into a single v1 because launch timing required a complete artifact; treat comments as v2 inputs, not as a reason to fork a second one-liner.*
