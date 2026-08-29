# OpenAsset Market — Threat Model (STRIDE)
**Version:** 2.1 (2026-08-28) | **Scope:** `LendingMarketV2`, `MarketFactoryV2`, all adapters, `AdapterRegistry`, `ChainlinkEquityFeedAdapter`, `UniswapV3TWAPAdapter`, `DEXSwapLiquidationAdapter`, `IssuerRedemptionLiquidationAdapter`, position adapters

---

## 1. Trust Boundaries

```
Untrusted: Borrower, Liquidator, Arbitrary adapter registrant, Price feed (Chainlink pool), L2 sequencer, Issuer redemption contract
Trusted: Factory owner multisig, Audit governance multisig, Protocol treasury, Market owner (for pause)
Semi-trusted: Verified adapter (audited but still balance-verified), Position holder
```

## 2. Critical Assets

- **Funds:** `lendingAsset` (USDC) pooled liquidity, collateral (ERC20/B20/ERC721)
- **State:** `Loan` principal/collateral, `totalLiquidity/availableLiquidity`, position ownership
- **Control:** `AdapterRegistry` verification marks, factory allowlists

## 3. STRIDE per Component

### 3.1 LendingMarketV2 (core engine)

| Threat | Example | Mitigation | Residual |
|--------|---------|------------|----------|
| **Spoofing** — attacker mints position for victim's loanId | Permissionless `mint` | `onlyMarket` via `authorizedMarkets[msg.sender]` + clone-per-market | Low — clone ensures isolation |
| **Tampering** — adapter returns inflated `recoveredForLP` | Compromised liquidation adapter | `balanceBefore/After` check `recoveredForLP==actualRecovery` else `AdapterUnderDelivered` | Low — `returnedToHolder` not verified on market (emitted, adapter-tested) |
| **Repudiation** — borrower denies loan | — | On-chain `LoanCreated` event + `positionAdapter.mint` | None |
| **Information Disclosure** — loan details | Public chain — all viewable | No private data on-chain | None |
| **Denial of Service** — `withdrawLiquidity` drains settling reserve | LP rug async surplus | `withdrawLiquidity` reserves `reservedForSettling` (`CURE/SETTLING` principals) and reverts `Reserved for settling loans` | Low — bounded scan 500 |
| **Elevation** — factory owner upgrades market | No proxy, immutable `lendingAsset`/`adapters` | Non-upgradeable; owner can only `pause/unpause` and set provider assets | Low |

### 3.2 Oracle Adapters

| Threat | Example | Mitigation | Residual |
|--------|---------|------------|----------|
| **Spoofing** — `updatePrice` sets arbitrary price | `UniswapV3TWAPAdapter.updatePrice` was permissionless | Now `onlyFactory` + primary path uses `OracleLibrary.consult` TWAP; fallback `lastPrice` gated by `FALLBACK_MAX_STALENESS=3600` | Low — keeper key is factory; TWAP manipulable only via sustained pool attack (costly) |
| **Tampering** — stale Chainlink price | Feed not updated for hours | `maxStaleness` check + `sequencer` liveness + `enforceTradingWindow` (B20 24/5) → `isTrusted==false` → market `PAUSED_STALE_ORACLE` | Low — weekend pause is intentional; NAV markets set `enforceTradingWindow=false` |
| **DoS** — L2 sequencer down freezes price | Base sequencer outage | `ChainlinkEquityFeedAdapter._isSequencerUp` with `SEQUENCER_MAX_STALENESS=3600` + grace `3600`; returns `isTrusted==false` | Accepted: market pauses, expiry-based liquidations still allowed |

### 3.3 Asset Adapters

| Threat | Example | Mitigation | Residual |
|--------|---------|------------|----------|
| **Tampering** — `isTransferable` lies, `escrow` takes 0 | Malicious adapter | Market checks `allowance(market)` correctly (`ERC20Adapter:63` fix) + `Escrow under-delivery` balance delta | Low — fee-on-transfer tokens intentionally unsupported |
| **Spoofing** — `release` sends to attacker | — | `release` only callable by market, `onlyFactory` for `configure` | None |

### 3.4 Compliance Adapters

| Threat | Example | Mitigation | Residual |
|--------|---------|------------|----------|
| **Spoofing** — adapter returns true for ineligible | Malicious compliance | Fail-closed: `try isEligible() returns false else NotBorrower`; `B20PolicyComplianceAdapter` checks both `TRANSFER_SENDER_POLICY` and `TRANSFER_RECEIVER_POLICY` with `policyId==0` sentinel skip | Low — `isEligible` revert also blocks |
| **Elevation** — Transferable position sold to ineligible | R-02 | Clone-per-market + `TransferablePositionAdapter._beforeTokenTransfer` calls `complianceAdapter.isEligible(to)` and reverts | Fixed via Clones |

### 3.5 Liquidation Adapters

| Threat | Example | Mitigation | Residual |
|--------|---------|------------|----------|
| **Tampering** — `DEXSwap` reverts 1 block late due to `deadline=block.timestamp` | Grief | Changed to `block.timestamp+900` + `minimumOutput` enforces slippage; requires `oracleTrusted` | Fixed |
| **Tampering** — async redemption never settles, `principal` stuck | Issuer never calls | `LIQUIDATION_SETTLING` persists, `reservedForSettling` blocks withdrawals, keeper can retry `finalizeRedemptionSettlement` which reverts `AdapterUnderDelivered` until proceeds arrive | Accepted: requires issuer liveness |
| **DoS** — liquidation `amountOut < debtOwed` | Thin liquidity | `require(amountOut >= debtOwed)` else revert whole tx atomically | None |

### 3.6 Factory & Registry

| Threat | Example | Mitigation | Residual |
|--------|---------|------------|----------|
| **Spoofing** — register malicious adapter and get verified | — | `registerAdapter` permissionless but `markVerified` only `auditGovernance`; UI reads `getAdapterInfo.verified` (now on-chain) | Low — unverified adapters clearly shown |
| **Repudiation** — duplicate market | — | `configHashToMarket` prevents duplicate `MarketAlreadyExists` | None |
| **Elevation** — factory owner allowlists malicious lending asset | — | `isAllowedLendingAsset` gate; malicious stable could have blacklist fee — mitigated by balance delta checks (fee-on-transfer fails) | Low |

## 4. Attack Paths & Preconditions

| Path | Steps | Precondition | Impact |
|------|-------|--------------|--------|
| **Oracle manipulation → under-collateral loan** | 1. Manipulate TWAP pool for `twapPeriod` (600-1800s). 2. Borrow at inflated collateral value. | Control deep liquidity for 10-30 min (cost: `liquidity * time`). | Drains pool. Mitigated by TWAP + `MAX_SANE_PRICE` + `isTrusted` staleness. |
| **Compliance bypass → ineligible borrow** | 1. Deploy TransferablePosition without hook, get verified via social. | Audit misses hook. | Ineligible holder. Mitigated by clone-per-market hook. |
| **Liquidation grief → bad debt** | 1. Congest network so `deadline` expires. | Old `deadline=block.timestamp`. | Fixed `+900`. |
| **Withdraw rug → async loss** | 1. LP withdraws while loan in `CURE`. | Old code allowed. | Fixed `reservedForSettling`. |

## 5. Residual Risk Register

| ID | Risk | Likelihood | Impact | Owner | Action |
|----|------|------------|--------|-------|--------|
| RS-01 | TWAP pool with <2 observations → fallback to `lastPrice` (keeper-fed) | Medium on new pools | High | Keeper | Monitor `observationCardinality` and auto-increase via `increaseObservationCardinalityNext` |
| RS-02 | B20 holiday not in 24/5 logic → false pause | Medium (10 NYSE holidays/yr) | Low (24h pause) | Operator | Use `registerFeedWithTokenOraclePause` with token's `oraclePaused` flag for holidays |
| RS-03 | Issuer redemption contract compromised | Low | Critical (async markets) | Legal + tech | Issuer due diligence; cap async markets TVL |
| RS-04 | Position clone `initialize` front-run | Low (factory is caller) | Medium | Factory | `Clones.clone` + immediate `initialize` in same tx; no front-run window |

## 6. Monitoring Requirements (link to OPERATIONS.md)

- `MarketCreated`, `LoanCreated/Repaid/Liquidated`, `CircuitBreakerTriggered`, `AdapterVerified/Deprecated`, `LiquidationCureStarted/SettlingStarted`, `AdapterUnderDelivered` reverts (indexer alert on revert rate >1%).
- `OracleRouter.AllOraclesFailed`, `ChainlinkEquityFeedAdapter` `isTrusted==false` duration >6h.
- `reservedForSettling` > `availableLiquidity` (withdraw block).

## 7. Assumptions

- Chainlink feeds are correct within `maxStaleness`; we do not check `answer` deviation vs TWAP.
- USDC (or allowlisted stable) has no transfer fees, no blocklist that would trap funds (if blacklisted, `release` will revert and loan becomes stuck — requires governance to allowlist new stable and migrate).
- Borrowers have verified `isTransferable` allows `market` spender, not `adapter`.
