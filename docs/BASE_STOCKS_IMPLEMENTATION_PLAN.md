# Base Tokenized Stocks (B20) — Day-1 Integration Plan

**Status:** Implementation-ready spec. All assumptions verified against official docs + source code (verification log: Appendix A).
**Sources:** https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base · B20 spec reference pages · repo @ `5c6c5cd`

---

## 0. Executive summary

Base's tokenized stocks are **B20 tokens**: ERC-20 extensions shipped as native precompiles in the Beryl upgrade. No per-token bytecode exists on Basescan; all tokens share one audited implementation. Because OpenAsset's engine only knows four verbs (escrow, price, eligibility, liquidate), B20 support requires **zero engine changes**:

| Layer | Verdict | Work |
|---|---|---|
| Asset (escrow) | ✅ Near-zero | New thin `B20AssetAdapter` (policy-aware `isTransferable`) |
| Oracle | ⚠️ Fix first | Reuse `ChainlinkEquityFeedAdapter`, but **fix a weekday-calendar bug** (§3, blocking) |
| Compliance | ➕ New | `B20PolicyComplianceAdapter` querying `IB20.policyId()` + `PolicyRegistry.isAuthorized` |
| Liquidation | ✅ Reuse | `DEXSwapLiquidationAdapter` (sync). `IssuerRedemption` adapter is **not usable** (AP-only) |
| Position | ✅ Reuse | Soulbound default when compliance attached |
| Backend indexer | 🔧 Extend | B20 event coverage (exact event names verified, §6) |
| Web | 🔧 Small | Scaled balances, market-hours states, geofence |

---

## 1. Verified integration facts

Every item below was checked against official Base docs or repo source. Line cites are current at commit `5c6c5cd`.

### 1.1 Token layer (verified against IB20 / IPolicyRegistry / IB20Factory spec references)

- B20 supports standard ERC-20 `transfer/transferFrom/approve/balanceOf/permit` (EIP-2612 built in).
- `approve()` is **not gated by any policy or pause** (spec: "Not gated by any policy or by pause"). Therefore allowance checks prove nothing about transferability.
- Transfer policies live in **per-token policy slots**, not a single global flag:
  - `TRANSFER_SENDER_POLICY` (`0xd116fc21`) — checked against `from`
  - `TRANSFER_RECEIVER_POLICY` (`0x210f521b`) — checked against `to`
  - `TRANSFER_EXECUTOR_POLICY` (`0x724e9c53`) — checked against `msg.sender` on `transferFrom` when distinct from `from`
  - Read via `policyId(policyScope)` (`0xdb3de624`). Returns `0` = always-allow builtin sentinel.
- **Registry-level `isAuthorized(policyId, account)` is confirmed real** (selector `0x55a1179e`): documented *"Returns whether account is authorized under policyId. Never reverts."* Unknown accounts/policies return false rather than reverting — no try/catch needed.
- Blocked transfers revert with custom error `PolicyForbids` (`0xa43fec12`).
- Tokens are identified **by address only** — `updateName`/`updateSymbol` are mutable admin ops.
- Discovery: factory event `B20Created` (topic0 `0xfd9bf273...`), plus `isB20(token)` on the factory for verification.
- Pauses are granular: `isPaused(feature)` / `pausedFeatures()`. Transfers can be paused independently of other features.

### 1.2 Multiplier & corporate actions (verified against IB20Asset spec reference)

- `multiplier` is WAD-scaled (`WAD_PRECISION() = 1e18`). Dividends convert to shares via multiplier increase; raw balances never change.
- Scheduled path (ERC-8056): `updateUIMultiplier(value, effectiveAt)` → read pending state via `newUIMultiplier()` / `effectiveAt()`; cancel via `cancelUIMultiplierUpdate()`.
- `updateMultiplier` (instant) is deprecated/emergency. It emits legacy `MultiplierUpdated`; the scheduled path emits `UIMultiplierUpdated` (topic0 `0x2205df45...`). **The external submission indexed `MultiplierUpdated` only — the plan must index BOTH.**
- `Announcement(id, description, uri)` + paired `EndAnnouncement` bracket corporate actions; often atomically bundled with the multiplier change.
- UI helpers for display: `scaledBalanceOf(account)` / `balanceOfUI(account)` / `toUIAmount(raw)`.
- `extraMetadata(key)` carries ISIN/CUSIP etc.; emits `ExtraMetadataUpdated`.

### 1.3 Price feeds (verified against official tokenized-stocks page)

- Coinbase feeds implement standard `AggregatorV3Interface`, 8 decimals, 24/5, update on 0.5% deviation or 24h heartbeat.
- Feeds report **Total Return Values**: `price = underlying × multiplier`. **Never apply the B20 multiplier on top of feed prices — that double-counts.** Valuation formula: `collateralValue = rawBalance × feedPrice / 1e18`.
- Feed freeze behavior during corporate actions: Coinbase oracle registry sets `paused=true` → feed stops publishing and holds last good value. Fail-safe design means it never publishes half-applied splits. Our staleness rejection handles this correctly.
- Off-hours, `updatedAt` stops advancing while calls still succeed → must check staleness, never settle against frozen price blindly.
- Chainlink Base mainnet sequencer uptime feed: `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433`.

---

## 2. 🔴 Blocking pre-fix: weekday calendar bug in `ChainlinkEquityFeedAdapter`

`contracts/src/adapters/rwa/ChainlinkEquityFeedAdapter.sol:135–145`:

```solidity
uint256 dayOfWeek = (block.timestamp / 86400 + 4) % 7; // comment claims 0=Monday
if (dayOfWeek >= 5) return false;
```

Unix epoch day 0 was a **Thursday**, so `(N + 4) % 7` yields **0 = Sunday**. The gate currently blocks **Fri+Sat** and **allows Sunday** — the exact inverse of intent. Consequence: on Sundays the market stays ACTIVE against a feed frozen since Friday close (staleness only kicks in >24h later); Saturdays are falsely closed.

**Fix (one line):** `+ 4` → `+ 3` (making 0=Sunday, so `>= 5` correctly blocks Sat/Sun), update the comment, and add unit tests for all 7 days of a known week.

## 3. Contracts workstream

### 3.1 `B20AssetAdapter` (new — `contracts/src/adapters/asset/`)

Thin wrapper over ERC-20 escrow with policy-aware transferability. **Must follow the multi-tenancy pattern** (`ERC20Adapter.sol:21–47`): per-market `mapping(address => MarketConfig)`, factory-gated `configure()`, SafeERC20, `Unconfigured market` guards.

```solidity
contract B20AssetAdapter is IAssetAdapter {
    struct MarketConfig { IB20 token; }          // keyed by market — NOT a bare storage var
    mapping(address => MarketConfig) public marketConfigs;

    function escrow(address from, uint256 amountOrId) external override {
        IB20 token = marketConfigs[msg.sender].token;
        require(address(token) != address(0), "Unconfigured market");
        token.safeTransferFrom(from, msg.sender, amountOrId);   // pulls from → MARKET (msg.sender)
    }
    // release(): mirror of ERC20Adapter.release

    function isTransferable(address from, address to, uint256 amountOrId)
        external view override returns (bool)
    {
        IB20 token = marketConfigs[msg.sender].token;
        if (address(token) == address(0)) return false;
        // Policy check: sender AND receiver slots. Registry.isAuthorized never reverts,
        // but guard unknown tokens anyway. Fail-closed.
        if (!_authorizedFor(token, token.TRANSFER_SENDER_POLICY(), from)) return false;
        if (!_authorizedFor(token, token.TRANSFER_RECEIVER_POLICY(), to)) return false;
        if (token.isPaused(PausableFeature.Transfers)) return false;   // verify enum name vs spec at impl
        // Allowance must be borrower → ADAPTER'S CALLER MARKET, i.e. allowance(from, msg.sender==market).
        // NOTE: in view context use the configured market for this caller:
        uint256 allowance = token.allowance(from, msg.sender);
        return token.balanceOf(from) >= amountOrId && allowance >= amountOrId;
    }
}
```

Notes:
- The engine's escrow under-delivery invariant (`LendingMarketV2.sol:383`) remains the final proof of delivery; policy reverts at origination are atomic and safe.
- Optionally use `transferFromWithMemo(bytes32 loanId)` for reconciliation — emits `Memo` event.
- Escrowed collateral sits in the **market contract**, which becomes the multiplier beneficiary: dividends accrue to the escrow contract and are returned with the loan at repay. Correct by construction; disclose in UI (TR §12.3).

### 3.2 `B20PolicyComplianceAdapter` (new — `contracts/src/adapters/rwa/`)

Mirrors `ERC3643ComplianceAdapter.sol` structure. Key difference: **self-configuring policy lookup** — no off-chain coordination needed:

```solidity
function isEligible(address participant) external view override returns (bool) {
    IB20 token = marketConfigs[msg.sender].token;      // configure(market) one-arg signature
    IPolicyRegistry registry = registry_;               // constructor param, NOT hardcoded constant
    bytes32 senderPolicy = token.policyId(token.TRANSFER_SENDER_POLICY());
    bytes32 receiverPolicy = token.policyId(token.TRANSFER_RECEIVER_POLICY());
    if (senderPolicy != 0 && !registry.isAuthorized(senderPolicy, participant)) return false;
    if (receiverPolicy != 0 && !registry.isAuthorized(receiverPolicy, participant)) return false;
    return true;
}
```

- Interface constraint: `IComplianceAdapter.configure(address market)` takes ONE arg (`interfaces/adapters/IComplianceAdapter.sol:26`). Token binding comes via separate factory-admin registration (same pattern as `registerFeed`). The external submission's claim that `_configureAdapters()` passes asset to every adapter is wrong for compliance adapters.
- `policyId == 0` means always-allow builtin → skip check.
- Registry address as constructor param (multi-chain + testability), not a hardcoded constant.
- Checked at origination (always when set) and position transfers per Validation Matrix R5 — note R5 is enforced **off-chain via adapter review**, not on-chain (`MarketFactoryV2.sol:332–340` explicitly punts). On-chain rules are: lending-asset allowlist, async⇒compliance, registry-selectable, dedup.

### 3.3 Oracle configuration (reuse `ChainlinkEquityFeedAdapter` post-fix)

```solidity
// Factory admin, per market:
chainlinkEquityAdapter.registerFeed(
    market,
    0x787f13dEa48Db0897CbCDD985de77809D837F988,   // Coinbase AAPL/USD TRV feed (example)
    90000,                                        // 25h — see staleness rationale below
    0xBCF85224fc0756B9Fa45aA7892530B47e10b6433    // Base sequencer uptime feed
);
```

- **`maxStaleness = 90_000`** (25h), not the submission's 86,700. Feed heartbeat is "at least every 24h"; 300s buffer risks false staleness on quiet weekdays. Weekend gaps are handled by the trading-window gate, not staleness.
- **Known limitation to document:** `getHistoricalPrice(secondsAgo)` ignores `secondsAgo` and returns latest (`:111–127`). Harmless today — the engine's circuit breaker uses its own `lastPrice` state (`LendingMarketV2.sol:585–599`), not this method — but do not build anything on it.
- **Monday-reopen behavior:** first trusted Monday price vs Friday's stored `lastPrice` can exceed `pauseThresholdBps` → `PAUSED_VOLATILITY`. Arguably correct-conservative; document in ops runbook so Monday pauses aren't treated as incidents.
- Liquidation during oracle-stale periods: market is NOT paused for liquidation (`liquidate()` at :467 has no `marketActive` gate) — liquidations proceed against last-known-good price. This is intentional and correct for equities: B20 transfers stay permissionless even when feeds freeze.

### 3.4 Liquidation

- **Default:** `DEXSwapLiquidationAdapter` (sync). B20 secondary markets run 24/7 on Base DEXs.
- **NOT usable:** `IssuerRedemptionLiquidationAdapter` — mint/redeem is AP-only; we have no issuer channel. Do not deploy it for B20 markets.
- Required hardening: min-liquidity + max-slippage guards in the DEX adapter path before swap initiation; thin pools fall back to gradual partial liquidation (already core engine behavior).

### 3.5 Position & lending asset

- Default `SoulboundPositionAdapter` when compliance attached (TR §11 recommendation — deployer-chosen, factory does not enforce a default).
- Lending asset must be in the stablecoin allowlist (`MarketFactoryV2.sol:292–295`, enforced on-chain).

### 3.6 Market creation parameters (Base mainnet example)

```solidity
MarketConfig memory cfg = MarketConfig({
    lpAddress: lp,
    collateralAsset: 0xb200000000000000000000C2e324d24d7eEcd1fb, // AAPLc
    assetAdapter: b20AssetAdapter,
    oracleAdapter: chainlinkEquityAdapter,      // registerFeed AFTER deploy
    complianceAdapter: b20PolicyAdapter,        // token-bind via registration call
    liquidationAdapter: dexSwapAdapter,
    positionAdapter: soulboundPositionAdapter,
    lendingAsset: usdcBase,
    ltvBasisPoints: 6500,          // conservative: weekend gap risk
    aprBasisPoints: 1200,
    durationSeconds: 30 days,
    gracePeriodHours: 72,
    enableHealthFactor: true,
    healthFactorThreshold: 12000,
    enableCircuitBreaker: true,
    pauseThresholdBps: 1000,       // 10% — equities < memecoins
    lookbackPeriodSeconds: 86400,
    resumeThresholdBps: 500,
    cooldownSeconds: 4 hours
});
```

## 4. Backend workstream

### 4.1 Indexer extensions (`backend/src/services/indexer/EventIndexerServiceV2.ts`)

Current V2 indexer handles factory/registry/market events with per-chainId checkpointing (`event_indexer_v2_${chainId}`). Add B20 event subscriptions:

| Event | Source | Topic0 | Purpose |
|---|---|---|---|
| `B20Created` | B20Factory | `0xfd9bf273...` | Auto-discovery of new listed stocks |
| `UIMultiplierUpdated` | Token | `0x2205df45...` | Scheduled multiplier changes (ERC-8056 path) |
| `MultiplierUpdated` | Token | `0x4dbe4840...` | Legacy instant/emergency multiplier changes |
| `UIMultiplierUpdateCancelled` | Token | `0x88385633...` | Cancelled scheduled update |
| `Announcement` / `EndAnnouncement` | Token | `0xccebf821...` / `0x96d64daf...` | Corporate-action context |
| `ExtraMetadataUpdated` | Token | `0xd7bb345b...` | ISIN/CUSIP surface |

Alert taxonomy rule for MonitoringService: **oracle freeze during an indexed corporate-action announcement ≠ incident.** Correlate `Announcement` events with `PAUSED_STALE_ORACLE` states before paging.

### 4.2 Config

Contract addresses config already uses `chainId:address` format (`unifiedConfig.ts:19`) — add chain 8453 entries for new adapters + the B20 factory address for discovery.

## 5. Web workstream

- **Share-equivalent balances:** display via `scaledBalanceOf` / `toUIAmount` so users see true share counts after dividends/splits. Valuation itself = raw × feed price.
- **Market-hours states:** "Market closed — originations paused" UI state driven by oracle trust signal (already generic on `isTrusted`).
- **Geofence:** US persons ineligible (`coinbase.com/tokenize`) — frontend jurisdiction gate.
- **Risk disclosures at market creation + origination** (TR §12.1/§18): issuer-insolvency-as-total-loss, custody model ("synthetic claim, not directly redeemable"), dividend pass-through mechanics, 24/5 trading hours, DEX-liquidation timeline.
- Token identity by address; resolve display name/symbol from indexed metadata with mutable-update handling.

## 6. Test plan

Contracts:
- Calendar fix: parametrized test over all 7 weekdays using known timestamps.
- `B20AssetAdapter`: policy-blocked sender/receiver revert at escrow; `PolicyForbids` surfaces cleanly; allowance-to-market check; multi-market isolation.
- `B20PolicyComplianceAdapter`: policyId=0 skip path; blocked participant fail-closed; unknown-policy behavior.
- Oracle: staleness boundary at 25h; sequencer-down → untrusted; frozen feed during simulated corporate action → origination blocked but liquidation allowed.
- Circuit breaker: Monday reopen vs Friday lastPrice > threshold → volatility pause (documented expected behavior).

Backend: indexer topic0 coverage tests; corporate-action/monitoring correlation logic.

E2E (Base Sepolia): full lifecycle — create market → originate → weekend pause → Monday resume → repay → liquidation via mock DEX.

## 7. Rollout order

1. **Phase 0 (blocking):** calendar fix + tests → contract suite green.
2. **Phase 1 (contracts):** deploy fixed oracle adapter + new B20 adapters to baseSepolia; register feeds w/ testnet equivalents; E2E lifecycle test.
3. **Phase 2 (backend):** indexer event coverage + monitoring taxonomy; config entries.
4. **Phase 3 (web):** scaled balances, market-hours state, geofence, disclosures.
5. **Phase 4 (mainnet):** launch subset of the 13 tickers with deepest DEX liquidity first (verify pool depth per ticker before enabling); LTV 65%; expand per liquidity data.

Mainnet reference addresses (from official docs — re-verify at deploy time):
- Registry: `0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD`
- Tokens: AAPLc `...C2e324d24d7eEcd1fb`, AMZNc `...d9192b6B456483C2E8`, COINc `...c85a31389D71F3ecfb`, CRCLc `...19f6E7C675b73C2e4D`, GOOGLc `...2D0BA3164cc74f58B7`, INTCc `...4AFF16039bA04bdFBc`, METAc `...8bC8786B856E61707C`, MSFTc `...Ab99cFa739E253872B`, MSTRc `...4884b426556b92883d`, NVDAc `...78ee7ce2fE4908108C`, SNDKc `...397293Cb8cda9a10c5`, SPCXc `...7b9fcbd005511aCBd5`, TSLAc `...1e800a7f5189430cD0`
- Chainlink TRV feed table in §3.3 source doc (all 8-decimal AggregatorV3 proxies).

## 8. Corrections vs external submission (for the record)

| External submission claimed | Verified reality |
|---|---|
| Calendar gate correct | 🔴 Inverted (+4 bug) — blocking fix required |
| `_configureAdapters()` passes asset to all adapters | Compliance interface is one-arg `configure(market)` |
| Hardcoded registry constant OK | Constructor param (multi-chain/testability) |
| Index `MultiplierUpdated` only | Both `MultiplierUpdated` AND `UIMultiplierUpdated` exist; index both |
| Validation Matrix fully enforced incl. R5 | R5 enforced off-chain only (code comment admits it) |
| `maxStaleness = 86,700` | 90,000 (heartbeat is "at least" 24h) |
| IssuerRedemption adapter usable | AP-only — not usable for B20 |

## Appendix A — Verification log

| Assumption | Method | Result |
|---|---|---|
| B20 = ERC-20 extension precompile, no bytecode | Official tokenized-stocks page | ✅ Confirmed |
| Policy slots per token (`policyId(scope)`, slot constants) | IB20 spec ref | ✅ Confirmed incl. selector `0xdb3de624` |
| `PolicyRegistry.isAuthorized(policyId, account)` never reverts | IPolicyRegistry spec ref | ✅ Confirmed (`0x55a1179e`) |
| `approve()` ungated by policy/pause | IB20 spec ref | ✅ Confirmed |
| Event names/topics (B20Created, UIMultiplier*, Announcement, ExtraMetadata*) | IB20Factory/IB20Asset spec refs | ✅ All confirmed |
| Feed = AggregatorV3, 8dec, TRV, 24/5, freeze-on-corporate-action | Official page | ✅ Confirmed |
| Sequencer feed Base mainnet | docs.chain.link l2-sequencer-feeds | ✅ `0xBCF8...6433` |
| Engine invariants (escrow :383, CB :576–583, liquidate ungated :467) | Source read @ `5c6c5cd` | ✅ Confirmed |
| Compliance interface one-arg configure | `IComplianceAdapter.sol:26` | ✅ Confirmed |
| Weekday calendar bug | Manual epoch math + source read | 🔴 Bug confirmed |
| Multi-chain address format in backend config | `unifiedConfig.ts:19` | ✅ Confirmed |
| Indexer checkpoint pattern per chainId | `EventIndexerServiceV2.ts:85,121` | ✅ Confirmed |
