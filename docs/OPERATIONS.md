# OpenAsset Market — Operations Runbook
**Applies to:** `LendingMarketV2`, `MarketFactoryV2`, adapters, backend `MonitoringServiceV2`, `KeeperService`, `LiquidationBotService`

## 1. Service Map

| Service | Repo | Interval | Alerts |
|---------|------|----------|--------|
| `MonitoringServiceV2` | `backend/src/services/MonitoringServiceV2.ts` | 60s | `CircuitBreakerTriggered`, `PAUSED_*` |
| `KeeperService` | `backend/src/services/KeeperService.ts` | 30s | Liquidation eligibility `NotLiquidatable` → `LiquidationCureStarted` |
| `LiquidationBotService` | `backend/src/services/LiquidationBotService.ts` | 30s | `liquidate`/`settleLiquidation`/`finalizeRedemptionSettlement` tx failure |
| Indexer | `backend/src/services/indexer/` | per block | `MarketCreated`, `LoanCreated/Repaid/Liquidated` lag >30s |
| AlertService | `backend/src/services/AlertService.ts` | event-driven | Email/SMS/push via SendGrid/Twilio/Firebase |

## 2. Critical Events & Paging

| Event | Severity | Page | Runbook |
|-------|----------|------|---------|
| `AdapterUnderDelivered` revert rate >1% (5 min) | P1 | PagerDuty | Check liquidation adapter `minimumOutput` vs pool liquidity; pause market if oracle untrusted |
| `MarketStatus.PAUSED_STALE_ORACLE` >6h | P1 | PagerDuty | Check `ChainlinkEquityFeedAdapter` sequencer `l2Sequencer` liveness + `isWithinTradingWindow`; verify `maxStaleness` vs heartbeat |
| `reservedForSettling > availableLiquidity` (withdraw blocked) | P2 | Slack | Keeper must call `finalizeRedemptionSettlement(loanId)` after issuer settles |
| `OracleRouter.AllOraclesFailed` | P1 | PagerDuty | Disable faulty oracle via `disableOracle`, check fallback |
| `isTransferable==false` but escrow succeeded | P2 | Slack | `ERC20Adapter` spender fix deployed; verify allowance target is `market` not `adapter` |

## 3. RPC Failover

- Chains: Sepolia, Base Sepolia, Base, Robinhood Testnet. Each has `createChainClient(chainId)` with `publicClient` per chain.
- If `publicClient.readContract` fails, retry 2x with 800ms backoff (`useMarkets.ts:221`), then fallback to `isBackendConfigured==false` on-chain path.
- Configure `SEPOLIA_RPC_URL`, `BASE_SEPOLIA_RPC_URL`, `ROBINHOOD_TESTNET_RPC_URL` with Alchemy + fallback Infura; `MonitoringServiceV2` cycles providers.

## 4. Circuit Breaker Tuning

| Param | Default | When to Change |
|-------|---------|----------------|
| `pauseThresholdBps` | 2000 (20%) | Lower for stable collateral, higher for meme |
| `lookbackPeriodSeconds` | 21600 (6h) | Shorter for fast-moving assets |
| `resumeThresholdBps` | 1000 (10%) | Must be < pauseThreshold |
| `cooldownSeconds` | 14400 (4h) | Increase during high volatility regime |
| `maxStaleness` (equity) | 90000 (25h) | Increase for holiday, decrease for intraday |
| `SEQUENCER_GRACE_PERIOD` | 3600 | Do not lower below 1800 |

## 5. Liquidation Ops

- **Sync:** Keeper calls `liquidate(loanId)` when `healthFactor < threshold` (trusted) OR `block.timestamp > expiry`. Requires `DEXSwapLiquidationAdapter` `amountOut >= debtOwed` (15 min deadline). If reverts `Insufficient liquidation output`, increase `maxSlippageBps` via `configureRisk` (max 500).
- **Async:** `liquidate` → `CURE` → wait `cureWindowSeconds` → `settleLiquidation` (submits redemption, moves to `SETTLING`) → wait issuer `checkSettlement==true` + proceeds at market/adapter → `finalizeRedemptionSettlement`. If `AdapterUnderDelivered` on finalize, proceeds not yet transferred — retry after issuer payout.

## 6. Incident Drill (playbook C1)

```
1. Detect: Alert on `CircuitBreakerTriggered` or `AllOraclesFailed`
2. Triage: Check `market.status`, `oracleAdapter.getPrice().isTrusted`, sequencer feed
3. Mitigate: If oracle compromised, `AdapterRegistry.markDeprecated(adapter, reason)` + `LendingMarketV2.pause()` via marketOwner
4. Communicate: Post to status channel, include `marketAddress`, `pausedAt`, `reason`
5. Recover: Deploy new adapter, verify, new markets use new adapter; existing markets remain paused until `unpause`
6. Postmortem: Document in `docs/incidents/YYYY-MM-DD.md`
```

## 7. Key Metrics (Prometheus `prom-client`)

- `openasset_markets_total`, `openasset_loans_active`, `openasset_liquidations_total`, `openasset_circuit_breaker_pauses_total`, `openasset_oracle_trusted{adapter}`, `openasset_reserved_for_settling`.

## 8. On-Call Rotation

- Primary: Founder, Secondary: Backend. Handoff via `KeeperService` liveness probe (must be GREEN).
