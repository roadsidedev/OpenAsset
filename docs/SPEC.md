# OpenAsset Market — Core Protocol Specification (Frozen)
**Version:** 2.1 (post-A1 audit, 2026-08-28)  
**Status:** Canonical — engineering implementation reference  
**Chain:** EVM (Ethereum, Base, Sepolia, Base Sepolia, Robinhood Testnet 46630)

This spec freezes the behavior audited in A1. Changes require version bump + re-audit.

---

## 1. Market Creation (`MarketFactoryV2.sol:158`)

### 1.1 Entry Points
- `createMarket(MarketConfig, initialLiquidity)` — generic
- `createB20Market(MarketConfig, initialLiquidity, B20MarketConfig{feed,maxStaleness,l2Sequencer})` — B20 tokenized stocks
- `createProviderMarket(MarketConfig, initialLiquidity, ProviderMarketConfig{providerId,providerData})` — extensible provider bundles

All are `nonReentrant`.

### 1.2 Validation Matrix (enforced at deploy, reverts on failure)

| Rule | Check | Error |
|------|-------|-------|
| **R0** | `lpAddress !=0`, `collateralAsset.isContract()`, `lendingAsset !=0`, 4 adapters !=0, `ltv 1-95%`, `apr ≤100%`, `duration 1h-365d` | `InvalidConfig` |
| **R1** | `isAllowedLendingAsset[lendingAsset]==true` | `LendingAssetNotAllowed` |
| **R2** | `isAsynchronous()==true ⇒ complianceAdapter !=0` | `AsyncLiquidationRequiresCompliance` |
| **R3** | `registry.isSelectable(adapter)` for all 5 adapters | `* adapter not selectable` |
| **R4** | `configHash` (collateral+lending+5 adapters+ltv+apr+duration+providerId+providerDataHash) not seen | `MarketAlreadyExists` |
| **R5** | TransferablePosition + compliance hook is enforced via clone-per-market (see §9.3); factory clones position adapter with `complianceAdapter` | — |
| **Provider** | If `providerId !=0`: configurator exists, `providerId` matches configurator, asset in `isProviderAsset[providerId][collateral]` | `ProviderNotConfigured` etc |
| **Asset Reservation** | If `providerId==0` and `canonicalProviderForAsset[collateral]!=0` | `AssetReservedForProvider` |

### 1.3 Fee & Liquidity
- `CREATION_FEE_BPS = 50` (0.5%) of `initialLiquidity` in lending-asset terms (USDC 6 decimals).
- `creationFee = initialLiquidity * 50 / 10000`, `netLiquidity = initialLiquidity - creationFee`.
- `safeTransferFrom(msg.sender→market, netLiquidity)` + `safeTransferFrom(msg.sender→treasury, creationFee)` then `LendingMarketV2.initializeLiquidity(netLiquidity, lpAddress)` which mints `netLiquidity * 1e18` LP shares.

### 1.4 Adapter Wiring
```
_configureAdapters:
  assetAdapter.configure(market, collateral)
  oracleAdapter.configure(market, collateral)
  complianceAdapter.configure(market) if set
  liquidationAdapter.configure(market, assetAdapter); if requiresCollateralHandoff() then configureRisk(market, oracleAdapter, 500)
  positionAdapter: clone via Clones.clone(template) → initialize(factory, complianceAdapter) → registerMarket(market)
```
Position adapters are **cloned per market** (EIP-1167) to avoid `loanId` collision; each clone holds isolated `mapping(loanId→owner)`.

### 1.5 Provider Bundle Atomicity
If `providerId !=0`, `IProviderConfigurator.configureMarket(... providerData)` is called. Any revert reverts entire `createMarket`. B20: binds `ChainlinkEquityFeedAdapter` feed + `B20PolicyComplianceAdapter` token.

---

## 2. Market Isolation

- Each `LendingMarketV2` is a standalone contract with isolated `totalLiquidity/availableLiquidity/totalBorrowed`, `mapping(loanId→Loan)`, `status`, `lastPrice`.
- Factory registries `allMarkets`, `lpToMarkets`, `assetToMarkets`, `configHashToMarket`, `marketProvider` are view-only; no cross-market calls.
- Collateral never leaves market except via `IAssetAdapter.release(to, amount)` to borrower/holder or to liquidation adapter.
- Insolvency in one market (`totalLiquidity < principal`) does not affect others.

---

## 3. Collateral Rules

- **Allowed types:** ERC20 (incl. B20 tokenized stocks), ERC721. ERC1155 not yet deployed (no adapter) — L-01.
- **Escrow:** `LendingMarketV2._requestLoan` checks `isTransferable(from, market, amount)` then `assetAdapter.escrow(from, amount)` and verifies `balanceBefore/After >= amount` (reverts `Escrow under-delivery`). Fee-on-transfer tokens will fail this check and are **not supported**.
- **Release:** `assetAdapter.release(holder, amount)` via `safeTransferFrom(market→holder, amount)` after market's `approve(max)` in constructor (guarded by `isContract`).
- **Decimals:** `collateralDecimals = IERC20Metadata(collateral).decimals()` else 18; `lendingDecimals` similarly, fallback 18, capped at 36.

---

## 4. Borrowing Rules

- **Eligibility:** If `complianceAdapter !=0`, `isEligible(borrower)` must return true else `NotBorrower` (fail-closed on revert).
- **Pricing:** `(price,isTrusted,updatedAt)=oracleAdapter.getPrice()` must be `trusted==true` and `0 < price < 1e36` else `OracleUntrusted`/`OraclePriceOutOfBounds`.
- **LTV:** `collateralValueInLending = amount * price / 10^collateralDecimals * 10^lendingDecimals / 1e18`. `maxLoan = collateralValue * ltvBps / 10000`. `principal` is `requestedPrincipal` if 0<li>Borrower-specified (bounded by maxLoan) else maxLoan. `requestedPrincipal==0 ⇒ max`. Must be `>0` and `≤ availableLiquidity`.
- **Duration:** `expiry = block.timestamp + durationSeconds`. Stored per loan.
- **Health factor:** If `enableHealthFactor`, `health = collateralValue * 10000 / (principal+interest)`; loan liquidatable when `trusted && health < threshold`.

---

## 5. Interest Model

- **APR annualized:** `aprBps` immutable per market, 365-day year, deterministic.
- **Formula:** `annualInterest = principal * aprBps / 10000`, `interest = annualInterest * elapsed / 365 days`.
- **Elapsed:** If `frozenInterestAt !=0` (entered LIQUIDATION_CURE), `elapsed = frozen - start`; else `elapsed = now - start`.
- **Revenue split on repay:** `revenue = totalDebt - principal` (interest + penalty), `protocolShare = revenue * 1000 / 10000` (10%), `lpRevenue = revenue - protocolShare`. Protocol keeps `protocolShare`, pool retains `principal + lpRevenue`.

---

## 6. LTV & Risk Parameters

- **LTV:** 1-95% immutable per market. Under-collateralized (≥100%) not allowed in 2.1; future flag will require compliance + verified oracle.
- **Health threshold:** 110-200% if enabled, immutable.
- **Circuit breaker:** Config `CircuitBreakerConfig{enabled, pauseThresholdBps, lookbackPeriodSeconds, resumeThresholdBps, cooldownSeconds}`. `_checkCircuitBreaker` on every `marketActive` call (i.e., `requestLoan`). Logic: if `!trusted ⇒ PAUSED_STALE_ORACLE`; else if `priceChange >= pauseThreshold ⇒ PAUSED_VOLATILITY`; else if `PAUSED_*` and `now >= pausedAt+cooldown && change < resumeThreshold && trusted ⇒ ACTIVE`. `lastPrice` only updated when `ACTIVE` to preserve resume baseline.
- **New in 2.1:** Equity feeds have per-market `enforceTradingWindow` (B20:true, NAV:false).

---

## 7. Liquidation

### 7.1 State Machine
```
ACTIVE / GRACE_PERIOD
  ├─ block.timestamp > expiry OR (trusted && health < threshold) ⇒ liquidate()
  │    ├─ if isAsynchronous()==true ⇒ LIQUIDATION_CURE (frozenInterestAt = now, cureDeadline = now + cureWindowSeconds)
  │    └─ else ⇒ sync path below
  └─ repay() / repayPartial() allowed in ACTIVE, GRACE, CURE

LIQUIDATION_CURE --(cure expires + settleLiquidation())--> LIQUIDATION_SETTLING
LIQUIDATION_SETTLING --(finalizeRedemptionSettlement() after issuer settled)--> LIQUIDATED
Any other ⇒ LIQUIDATED (sync)
REPAID / LIQUIDATED terminal
```

### 7.2 Sync Liquidation (`DEXSwapLiquidationAdapter`)
- Requires `requiresCollateralHandoff()==true` → market `assetAdapter.release(liquidationAdapter, collateralAmount)` first.
- Adapter swaps `collateralAmount` → `lendingAsset` via Uniswap V3 `exactInputSingle` with `deadline = now + 900` (15 min) and `amountOutMinimum = getLiquidationMinOutput(collateralAmount, debtOwed, maxSlippageBps)`.
- `getLiquidationMinOutput` returns `max(oracleValue * (1 - slippage), debtOwed)`; returns `(0,false)` if oracle untrusted.
- Market verifies `recoveredForLP == balanceAfter - balanceBefore` else `AdapterUnderDelivered`. `returnedToHolder = amountOut - debtOwed` sent to `holder` by adapter (emitted, not balance-verified on market).
- Updates `totalBorrowed -= principal`, `availableLiquidity += recovered`, `totalLiquidity -= (principal - recovered)` if loss.

### 7.3 Async Liquidation (`IssuerRedemptionLiquidationAdapter`)
- `liquidate()` in CURE does nothing; `settleLiquidation()` after cure submits `issuerRedemption.submitRedemption(token, market, debtOwed)` → `redemptionId`, returns `(0,0)`, market moves to SETTLING (balance delta must be 0).
- `finalizeRedemptionSettlement()` (permissionless) calls adapter `claimSettlement(loanId)` which checks `issuer.checkSettlement(redemptionId)` and forwards `proceeds` to market. Market verifies `proceeds == balanceDelta` else `AdapterAccountingMismatch`; `proceeds==0 ⇒ AdapterUnderDelivered` (keep polling). Then marks LIQUIDATED, burns position, updates liquidity as sync.

### 7.4 Penalty
- 5% of principal added to `debtOwed` on liquidation; also charged on `repay` when in CURE (genuine default). `penalty = principal * 500 / 10000`.

---

## 8. Fees

- **Creation:** 0.5% of `initialLiquidity` to `protocolTreasury` (see §1.3).
- **Ongoing:** 10% of interest+penalty revenue to treasury on each (partial) repay and on liquidation surplus. No fee on principal.
- **No other fees:** Gas is user-paid; no withdraw fee; no oracle fee.
- **Display:** Frontend shows `creationFee`, `netLiquidity`, `totalApproval` before deployment and dry-runs `simulateContract`.

---

## 9. Adapter Interfaces (frozen)

| Type | Interface | Config | Core Verbs |
|------|-----------|--------|------------|
| Asset | `IAssetAdapter` `interfaces/adapters/IAssetAdapter.sol:17` | `configure(market, collateral)` | `escrow(from,amount)`, `release(to,amount)`, `isTransferable(from,to,amount) view` |
| Oracle | `IOracleAdapter` `IOracleAdapter.sol:18` | `configure(market, asset)` + `registerFeed` etc | `getPrice()→(price,isTrusted,updatedAt)`, `getHistoricalPrice(secondsAgo)` |
| Compliance | `IComplianceAdapter` | `configure(market)` | `isEligible(participant) view` **fail-closed** |
| Liquidation | `ILiquidationAdapter` `ILiquidationAdapter.sol:22` | `configure(market,assetAdapter)` | `liquidate(loanId,debtOwed)→(recovered,returned)`, `isAsynchronous`, `cureWindowSeconds`, `requiresCollateralHandoff` |
| Position | `IPositionAdapterInit` `IPositionAdapterInit.sol:16` | `initialize(factory, compliance)` + `registerMarket` | `mint(to,loanId)`, `ownerOf(loanId)`, `burn(loanId)` |

**Invariants:** Every adapter is multi-tenant (`mapping(market→config)`) except Position which is cloned per market. `isTrusted==false` pauses originations but not expiry-based liquidations. All adapter outputs are balance-verified by engine where feasible.

---

## 10. Permissions

| Action | Who |
|--------|-----|
| `MarketFactoryV2.createMarket` | permissionless (any EOA) |
| `MarketFactoryV2.setProviderAsset / setProviderConfigurator / addLendingAsset` | `owner` (governance multisig) |
| `LendingMarketV2.depositLiquidity` | anyone (mints LP shares) |
| `withdrawLiquidity` | LP share holder; blocked if `available < amount+reservedForSettling` |
| `requestLoan` | any eligible borrower (compliance check) |
| `repay / repayPartial` | anyone (anyone can repay any loan; collateral goes to `ownerOf(loanId)`) |
| `liquidate / settleLiquidation / finalizeRedemptionSettlement` | anyone (permissionless keeper) |
| `pause / unpause` | `marketOwner` only |
| `AdapterRegistry.markVerified / markDeprecated / setAuditGovernance` | `auditGovernance` multisig |
| `ChainlinkEquityFeedAdapter.registerFeed` | factory/owner/configurator |
| `UniswapV3TWAPAdapter.registerPoolForMarket` | factory only |

---

## 11. Borrower Requirements

- Hold `collateralAmount` of collateral token with `allowance(market) >= amount` (ERC20) or `isApprovedForAll / ownerOf` (ERC721).
- Pass `isEligible` if market has compliance.
- Accept `lendingAsset` (e.g., USDC) transfer of `principal`.
- Must repay `totalDebt = principal + interest [+penalty if in CURE]` before `expiry + grace` or before health breach.

---

## 12. Emergency Controls

- **Circuit breaker:** Auto-pause on `isTrusted==false` or volatility; auto-resume after `cooldown` and `change < resumeThreshold`. Manual `pause()`/`unpause()` by `marketOwner`.
- **Registry deprecation:** `markDeprecated` blocks new markets with that adapter; existing markets continue but UI surfaces warning.
- **No global pause:** Each market independent; factory has no kill-switch (intentional). Incident response is per-market `pause` + registry deprecation + indexer alert.
- **Upgrade:** Contracts are **non-upgradeable** (no proxy). Markets are immutable; adapters are immutable per deployment but new versions can be registered and selected for new markets. Position clones are immutable per market.

---

## 13. Upgrade Model

- **No in-place upgrades.** New `LendingMarketV2` logic requires new `MarketDeployer` + `MarketFactoryV2` deployment and new markets. Existing markets continue on old code.
- **Adapter versioning:** Deploy new adapter, `registerAdapter`, verify, then new markets pick new version. Existing markets cannot swap adapters (immutable wiring).
- **Migration:** LPs can `withdrawLiquidity` and create new market with new adapters; borrowers must repay and re-borrow.

---

## 14. Edge Cases (normative)

| Case | Behavior |
|------|----------|
| Fee-on-transfer / rebasing collateral | `isTransferable` may pass but `escrow` balance delta fails → revert `Escrow under-delivery`. Such tokens are unsupported. |
| Oracle `isTrusted==false` on `requestLoan` | Revert `OracleUntrusted`. |
| Oracle `isTrusted==false` on `healthFactor` | `healthFactor==0, trusted==false` ⇒ `healthFactorBreached==false`; only `expiry` can trigger liquidation. |
| Equity market on weekend / holiday (B20) | `isTrusted==false` ⇒ market `PAUSED_STALE_ORACLE`, `requestLoan` blocked, health checks rely on expiry. If `enforceTradingWindow==false` (NAV), weekend prices remain trusted. |
| L2 sequencer down (Base) | `ChainlinkEquityFeedAdapter` returns `(0,false,0)` if `sequencer !=0` and `_isSequencerUp==false`; market pauses. |
| `isTransferable==false` but `escrow` would succeed | `requestLoan` reverts early `InvalidAmount` — gas saved. |
| `repayPartial` with `repayAmount==totalDebt` | Treated as full repay (release + burn). |
| `withdrawLiquidity` with loans in `CURE/SETTLING` | Reverts `Reserved for settling loans` if `available < amount + reserved`. Call `finalizeRedemptionSettlement` first. |
| `getMarketStats` with 10k loans | Use `getMarketStatsPaginated(start,end)` (max 1000) and `getLoansPaginated(start,end)` (max 200); legacy `getMarketStats` iterates all and will OOG. |
| Underwater liquidation (collateral < debt) | `recoveredForLP = actualRecovery (< principal)`, `totalLiquidity` reduced by `principal - recovered`. |
| Reentrancy via token callback | All state-changing entry points are `nonReentrant` and follow CEI. |

---

## 15. Fee Example (USDC 6 decimals)

`initialLiquidity = 1,000,000 (1,000 USDC)` ⇒ `creationFee = 1,000,000 * 50 / 10000 = 5,000 (5 USDC)` ⇒ `netLiquidity = 995,000 (995 USDC)` to market, 5 USDC to treasury.

---

*End of frozen spec. Any deviation is a bug.*
