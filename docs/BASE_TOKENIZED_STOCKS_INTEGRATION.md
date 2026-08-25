# Base Tokenized Stocks (B20) Integration Path

**Status:** Proposed architecture — pending implementation
**Source:** https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base

---

## TL;DR

Base's tokenized stocks are **B20 tokens — plain ERC-20 extensions issued as native precompiles**. Our adapter architecture absorbs them almost entirely with **zero core-engine changes**:

| Layer | Verdict | Work |
|---|---|---|
| Asset (escrow) | ✅ Existing `ERC20Adapter` works as-is | None |
| Oracle | ✅ `ChainlinkEquityFeedAdapter` was built for exactly this | Register Coinbase TRV feeds |
| Liquidation | ⚠️ DEX-swap only | Liquidity-depth guards |
| Compliance | ➕ New small adapter (optional) | `B20PolicyComplianceAdapter` |
| Indexer / backend | 🔧 Event coverage additions | `B20Created`, `MultiplierUpdated`, pauses |

---

## 1. Why B20 fits our architecture

B20 is an ERC-20 extension. Standard `transfer`, `transferFrom`, `approve`, `balanceOf` all work natively. Our engine's four verbs (escrow, price, eligibility, liquidate) map cleanly:

```
LENDING MARKET
     │
ERC20Adapter ──────────► escrow/release B20 like any ERC-20
ChainlinkEquityFeedAdapter ► price via Coinbase Total-Return feeds (24/5)
B20PolicyComplianceAdapter ► optional transfer-policy checks (new)
DEXSwapLiquidationAdapter ─► liquidate via Uniswap V3 on Base
```

## 2. Layer-by-layer analysis

### 2.1 Asset layer — no changes

`contracts/src/adapters/asset/ERC20Adapter.sol` handles B20 untouched:
- Escrow via `safeTransferFrom`, release via `safeTransferFrom`.
- **One caveat:** B20 *policies* can block transfers at transfer time, and `approve()` is **not** policy-gated — so `isTransferable()` (balance + allowance check) can pass while the actual escrow transfer reverts. Mitigation: pre-flight `isAuthorized(policyID, account)` check in the compliance adapter (below), plus graceful revert handling at origination (no state corruption — escrow reverts atomically).

### 2.2 Oracle layer — `ChainlinkEquityFeedAdapter` is a direct match

`contracts/src/adapters/rwa/ChainlinkEquityFeedAdapter.sol` was designed for this asset class and matches Base's launch setup almost line-for-line:

- **Coinbase feeds implement AggregatorV3Interface**, read via proxy `latestRoundData()` — exactly what the adapter consumes. 8 decimals, adapter normalizes to 18-WAD USD.
- **Total Return Values**: feed price = underlying × multiplier. Because the feed is total-return, **collateral valuation needs no multiplier math on our side**: `value = rawBalance × feedPrice`. This is the single most important simplification — do NOT apply `multiplier` again on top of TRV prices (double-counting).
- **24/5 session awareness**: feed holds last close nights/weekends/holidays; `updatedAt` stops advancing. The adapter's staleness bound will correctly return `isTrusted=false` outside windows → circuit-breaker pause path.
- **L2 sequencer uptime check**: adapter already supports it; Base's sequencer feed address must be passed at `registerFeed()`.
- **Corporate-action fail-safe**: feed freezes rather than publishing half-applied split values — our staleness rejection handles it.

**Configuration decisions needed:**
1. `maxStaleness` — must tolerate legitimate weekend holds (~64h+) vs. corporate-action freezes (indefinite). Recommend: origination gated by trust signal (weekend = no new loans); liquidations allowed against last-known-good value with a conservative haircut parameter, since frozen last-close is still the best available mark and B20 transfers are *not* paused onchain during corporate actions.
2. Feed registry (mainnet addresses from Base docs): AAPL, AMZN, COIN, CRCL, GOOGL, INTC, META, MSFT, MSTR, NVDA, SNDK, SPCX, TSLA.

### 2.3 Liquidation — DEX swap only

- **`IssuerRedemptionLiquidationAdapter` is NOT usable**: mint/redeem on tokenized stocks is restricted to Authorized Participants. We are not an AP; there is no issuer redemption channel for us.
- **`DEXSwapLiquidationAdapter`** is the path. B20s trade 24/7 on Base DEXs, and transfers stay enabled even during corporate actions. Requirements:
  - Minimum-liquidity / max-slippage guard before initiating swaps (long-tail stocks may have thin pools).
  - Fallback: partial gradual liquidation already exists in the engine — good fit for thin pools.

### 2.4 Compliance — new small adapter (optional but recommended)

`B20PolicyComplianceAdapter implements IComplianceAdapter`:
- Read the token's policy registry, call `isAuthorized(policyID, account)` for borrower (and optionally LP).
- Prevents origination into positions that can never be unwound due to a blocklist.
- ~80 LOC, mirrors `ERC3643ComplianceAdapter.sol` structure (factory-configured multi-tenant).

### 2.5 Pauses & announcements — indexer work (backend)

Backend indexer (`backend/src/workers/indexerWorker.ts`) additions:
- Watch **`B20Created`** for automatic discovery of new listed stocks.
- Index **`MultiplierUpdated`**, **`Announcement` / `EndAnnouncement`**, and pause-state changes → surface in MonitoringService alerts (corporate action = expected oracle freeze, don't page as anomaly).
- Identify tokens **by address, never symbol** (metadata is mutable onchain; name/symbol updatable).

### 2.6 Web UI note

Display "share-equivalent" balances using `scaledBalanceOf` / `toScaledBalance` (raw × WAD-scaled multiplier) so users see true share counts after dividends/splits. Valuation itself keeps using the feed price.

## 3. Implementation order

1. **Contracts:** deploy `ChainlinkEquityFeedAdapter` + register feeds on baseSepolia; add `B20PolicyComplianceAdapter`; wire DEXSwap slippage guards for B20 markets.
2. **Tests:** mock B20 (policy-revert-on-transfer, multiplier updates, paused feed) — extend `MockChainlinkFeed.sol` patterns.
3. **Backend:** indexer events + monitoring alert taxonomy (corporate-action freeze ≠ incident).
4. **Web:** scaled-balance display + "market closed / oracle stale" states.
5. **Rollout:** baseSepolia E2E → Base mainnet with the 13 launch tickers, conservative LTVs initially (equities gap over weekends).

## 4. Open questions

- Confirm whether Base publishes an official token list endpoint for automated B20 discovery (vs. indexing `B20Created` only).
- Uniswap V3 pool depth per ticker at launch — determines whether DEX-only liquidation is viable for all 13 or a subset initially.
