# A1 — Audit the Existing MVP
**Workstream:** A — Protocol and Product | **Phase:** 1 | **Priority:** P0
**Status:** REVIEW → DONE (pending founder sign-off)
**Date:** 2026-08-28 | **Auditor:** OpenCode (Muse Spark)

> Playbook A1 Steps 1-10 mapped verbatim below. Evidence-backed, file paths include `line:line` where applicable.

---

## 1. List Every Existing Protocol Contract

### 1.1 Core Engine (V2 = Canonical, V1 = Legacy/deprecated but still in repo)

| Contract | Path | Status | Role |
|----------|------|--------|------|
| `LendingMarketV2.sol` | `contracts/src/LendingMarketV2.sol:59` | **Canonical** | Isolated market engine. Holds `Loan` struct `91:98`, `MarketStatus`/`LoanStatus` enums `73:88`, circuit breaker `610:664`, defensive invariants. |
| `LPTokenV2` | `contracts/src/LendingMarketV2.sol:21` | Canonical | ERC20 share token, `mint`/`burn` gated by `market` `28:36` |
| `MarketFactoryV2.sol` | `contracts/src/MarketFactoryV2.sol:31` | Canonical | Permissionless factory, validation matrix `353:431`, provider-bundle routing `205:307`, fee in lending-asset terms `270:275` |
| `MarketDeployer.sol` | `contracts/src/MarketDeployer.sol` | Canonical | Minimal-proxy deployer for `LendingMarketV2` (clone via factory) |
| `AdapterRegistry.sol` | `contracts/src/AdapterRegistry.sol:20` | Canonical | Permissionless registry, `AdapterType` enum `23`, governance-gated `markVerified` `132`/`markDeprecated` `149` |
| `ProviderIds.sol` | `contracts/src/ProviderIds.sol` | Canonical | Constants `B20`, `ROBINHOOD` provider IDs |
| `LendingMarket.sol` | `contracts/src/LendingMarket.sol` | **Legacy V1** | Isolated market V1 (ETH-native `msg.value` liquidity). Superseded by V2. |
| `MarketFactory.sol` | `contracts/src/MarketFactory.sol` | **Legacy V1** | V1 factory (`msg.value - creationFee` pattern, ETH-denominated) |
| `LoanContract.sol` | `contracts/src/LoanContract.sol:27` | **Legacy V1** | Per-loan escrow via minimal proxy. Still compiled, not used by V2. |
| `CircuitBreaker.sol` | `contracts/src/libraries/CircuitBreaker.sol` | Shared lib | `AssetHandler` library used by V1 |
| `ChainlinkOracle.sol` | `contracts/src/libraries/ChainlinkOracle.sol` | Shared lib | Chainlink helper |
| `OracleRouter.sol` | `contracts/src/oracles/OracleRouter.sol` | Active | Routes between primary/fallback/tertiary oracles, `getPriceWithSource` + `configureOracleBatch` |
| `ChainlinkOracle.sol` (oracles/) | `contracts/src/oracles/ChainlinkOracle.sol` | Active | Legacy chain oracle wrapper |
| `NFTOracle.sol` | `contracts/src/NFTOracle.sol` | Active | NFT floor oracle, `getFloorPrice` reverts `StalePrice` on staleness |

**Deployment footprint (verified on-chain via `web/src/lib/contracts.ts:28`):**

| Chain | FactoryV2 | Deployer | Registry | Notes |
|-------|-----------|----------|----------|-------|
| Base Sepolia 84532 | `0x9531…De4` `53` | `0xCB8B…5B1` `54` | `0x80f7…7D7` `55` | Full B20 bundle deployed 2026-08-27 |
| Sepolia 11155111 | `0x0b75…C4` `75` | `0xcDAC…E26` `76` | `0x7b62…3e3` `77` | No B20/Robinhood adapters |
| Base 8453 | `0x000…0` `31` | `0x000…0` `32` | `0x000…0` `33` | ENV placeholder — mainnet not deployed |
| Robinhood Testnet 46630 | `0x331b…BB` `119` | `0x0400…81` `120` | `0xf142…A2C` `121` | Full provider bundle with mocks |
| Robinhood Mainnet 4663 | `0x000…0` `96` | `0x000…0` `97` | `0x000…0` `98` | Blocked pending manifest verification |

---

## 2. List Every Adapter

### 2.1 Interface Contracts (canonical `contracts/src/interfaces/adapters/`)

| Interface | Path | Key Methods |
|-----------|------|-------------|
| `IAssetAdapter.sol` | `interfaces/adapters/IAssetAdapter.sol:17` | `configure(market, token)` `24`, `escrow` `32`, `release` `41`, `isTransferable` `53` |
| `IOracleAdapter.sol` | `interfaces/adapters/IOracleAdapter.sol:18` | `configure(market, asset)` `24`, `getPrice(){price,isTrusted,updatedAt}` `34`, `getHistoricalPrice` `44` |
| `IComplianceAdapter.sol` | `interfaces/adapters/IComplianceAdapter.sol` | `configure(market)` + `isEligible(participant)` fail-closed |
| `ILiquidationAdapter.sol` | `interfaces/adapters/ILiquidationAdapter.sol:22` | `configure(market,assetAdapter)` `28`, `liquidate→(recoveredForLP,returnedToHolder)` `42`, `isAsynchronous` `53`, `cureWindowSeconds` `63`, `requiresCollateralHandoff` `70` |
| `IPositionAdapter.sol` | `interfaces/adapters/IPositionAdapter.sol:20` | `mint` `28`, `ownerOf` `38`, `burn` `46` |
| `IPositionAdapterInit.sol` | `interfaces/adapters/IPositionAdapterInit.sol` | `initialize(factory, complianceAdapter)` + clone template |
| `IProviderConfigurator.sol` | `interfaces/IProviderConfigurator.sol` | `providerId()`, `configureMarket(market,collateral, assetAdapter, oracleAdapter, complianceAdapter, liquidationAdapter, providerData)` |

### 2.2 Deployed Adapters (by type, from `contracts/src/adapters/`)

**Asset (3):**
- `ERC20Adapter.sol:16` — multi-tenant, `mapping(market→token)`, `onlyFactory` configure `37`, `safeTransferFrom(from→msg.sender)` escrow `44:48`
- `ERC721Adapter.sol` — same pattern, `safeTransferFrom` for NFTs
- `B20AssetAdapter.sol` (`adapters/asset/B20AssetAdapter.sol`) — B20 tokenized-stock asset wrapper, custodies via policy registry

**Oracle (4 + 1 NAV):**
- `UniswapV3TWAPAdapter.sol:17` — multi-tenant TWAP, `twapPeriod` immutable `19`, `onlyFactory` `updatePrice(market,newPrice)` `92`, `getPrice` reads `marketConfigs[msg.sender]` `74:80`, `registerPoolForMarket` gated `64`
- `ChainlinkAdapter.sol` (`adapters/oracle/ChainlinkAdapter.sol`) — generic Chainlink feed
- `ChainlinkEquityFeedAdapter.sol:30` — 24/5 equity/RWA oracle, sequencer-liveness `148:231`, trading-window gate `195:206`, `maxStaleness` + `registerFeedWithTokenOraclePause` `114`, `SEQUENCER_GRACE_PERIOD=3600` `48`
- `NAVOracleAdapter.sol` (`adapters/rwa/NAVOracleAdapter.sol`) — NAV oracle for RWA
- `OracleRouter.sol` — meta-oracle routing primary/fallback/tertiary (note: `getPriceWithSource` not view `290`, `configureOracleBatch` hardcodes tertiary `0x0` `139`)

**Compliance (3):**
- `ERC3643ComplianceAdapter.sol` — ERC-3643 identity registry
- `B20PolicyComplianceAdapter.sol:39` — B20 `policyId(scope)→PolicyRegistry.isAuthorized` fan-out, fail-closed, `policyId==0` sentinel `126`, two-step `registerToken` `93`
- `ManagedAllowlistComplianceAdapter.sol` — Robinhood allowlist

**Liquidation (3):**
- `DEXSwapLiquidationAdapter.sol:47` — sync, `requiresCollateralHandoff=true` `187`, Uniswap V3 `exactInputSingle` `153`, `minimumOutput` via `getLiquidationMinOutput` `141`, re-approves 0→amount `150`
- `NFTAuctionLiquidationAdapter.sol` — sync, NFT auction
- `IssuerRedemptionLiquidationAdapter.sol` — **async**, `isAsynchronous=true`, `cureWindowSeconds` >0, `requiresCollateralHandoff=false`, submits redemption without handoff

**Position (3 — clone templates):**
- `StandardPositionAdapter.sol:18` — mapping-only, no token, `onlyMarket` `24`, `onlyFactory` `53` for `registerMarket`, `Initializable` `37:50`
- `SoulboundPositionAdapter.sol` — non-transferable ERC721
- `TransferablePositionAdapter.sol` — transferable ERC721 + compliance hook (`isEligible(recipient)` per Validation Matrix R5, off-chain-enforced per `MarketFactoryV2.sol:332:340`)

**Provider Configurators (2):**
- `B20ProviderConfigurator.sol` (`providers/B20ProviderConfigurator.sol`) — atomically binds B20 feed + policy in `createB20Market` `173:189`
- `RobinhoodProviderConfigurator.sol` — Robinhood bundle (RWA + sequencer)

**Mocks (7 in `contracts/src/mocks/adapters/`):** `MockAssetAdapter`, `MockOracleAdapter`, `MockComplianceAdapter`, `MockLiquidationAdapter`, `MockPositionAdapter`, `ManipulatedOracleAdapter`, `MaliciousAdapters`

---

## 3. Map Every User Flow

### 3.1 End-to-End Flow Inventory (frontend `web/src/app/`)

| Flow | Entry | Steps | Contracts Touched | Backend Touched | Status |
|------|-------|-------|-------------------|-----------------|--------|
| **1. Connect Wallet** | `app/page.tsx`, `Navbar.tsx`, `AppShell.tsx` | Privy `usePrivy` + wagmi `useAccount` → chain switch | — | `POST /auth/nonce` | ✅ Works, Privy + wagmi 3.4 |
| **2. Browse Markets** | `app/markets/page.tsx:23` | `useMarkets(start,50)` → `useEnrichedMarkets` → category tabs `13:19` (All/RWA/Tokenized Equities/Tokens/NFT) → search `39:44` via `assetSearchHaystack` → `MarketCard` `136` + `PlatformStatsDashboard` `63` | `MarketFactoryV2.getAllMarkets` `498`, `LendingMarketV2.getMarketStats` `727` | `MarketService`, `MonitoringServiceV2`, indexer | ✅ Functional, filters client-side |
| **3. Market Details** | `app/markets/[marketId]/page.tsx` | Fetch `marketAddress` param → read `getLoanDetails` `704`, `getHealthFactor` `682`, `totalLiquidity` | `LendingMarketV2` views | `LoanService` | ✅ Functional |
| **4. Create Market (8-step wizard)** | `app/create-market/page.tsx:37` | See §4 for full map. Chain indicator `302:306` → 8-step progress `311:335` → adapters from `getContracts` `67:96` (hardcoded, no on-chain registry reads) → deploy `handleDeploy` `198:283` | `MarketFactoryV2.createMarket` `158` / `createB20Market` `173` / `createProviderMarket` `195` + `_configureAdapters` `314:351` | `MarketService` indexer within 60s | ⚠️ Partial — see limitations |
| **5. Supply Liquidity** | `app/supply/marketId/page.tsx` + `DepositModal.tsx` | Approve `lendingAsset` → `LendingMarketV2.depositLiquidity(amount)→shares` `318:329` → `LPTokenV2.mint` | `LendingMarketV2`, `LPTokenV2`, `IERC20` | `MarketService` | ✅ Functional |
| **6. Withdraw Liquidity** | `WithdrawModal.tsx` | `withdrawLiquidity(shares)→amount` `336:349`, reverts if `amount > availableLiquidity` `340` | Same | Same | ✅ Functional |
| **7. Borrow / Request Loan** | `app/borrow/[marketId]/page.tsx` | Select market → approve collateral → `requestLoan(collateralAmount, requestedPrincipal)` `358:379` → `assetAdapter.escrow` `414` → `positionAdapter.mint` `432` → `lendingAsset.safeTransfer(principal)` `437` | `LendingMarketV2._requestLoan` `381:440`, `IAssetAdapter`, `IOracleAdapter.getPrice` `400`, `IComplianceAdapter.isEligible` `387` | `LoanService`, `AlertService`, health monitoring queue | ✅ Functional (requestedPrincipal=0 ⇒ max) |
| **8. Repay Loan** | `app/repay/loanId/page.tsx` | `repay(loanId)` `446:491` → `lendingAsset.safeTransferFrom(totalDebt)` `465` → split `revenue → protocol 10%` `468:474` → `assetAdapter.release(holder, collateralAmount)` `479` → `positionAdapter.burn` `482` → `positionAdapter.ownerOf` used for holder `478` | `LendingMarketV2`, `IPositionAdapter`, `IAssetAdapter` | `LoanService` | ✅ Functional |
| **9. Liquidate (sync)** | Keeper / anyone | `liquidate(loanId)` `497:562` → health check `508:515` (oracle must be trusted) → `LIQUIDATION_CURE` if async `525:534` else `assetAdapter.release(liquidationAdapter,collateralAmount)` `539` → `liquidationAdapter.liquidate(loanId,debtOwed)` `542` → `balanceBefore/After` verification `541:548` → `totalLiquidity -= loss` `555` | `LendingMarketV2`, `ILiquidationAdapter`, `DEXSwapLiquidationAdapter` | `LiquidationBotService`, `KeeperService` | ✅ Functional (DEX path audited) |
| **10. Liquidate (async)** | Two-tx | `liquidate()` enters `LIQUIDATION_CURE` + `frozenInterestAt` `528`, cure deadline emitted `532` → off-chain issuer redemption → `settleLiquidation(loanId)` `568:607` after `cureWindowSeconds` `573` → `requiresCollateralHandoff` check `586` | Same + `IssuerRedemptionLiquidationAdapter` | Keeper + issuer API | ⚠️ Partial — issuer redemption flow mock-tested only |
| **11. Portfolio / Positions** | `app/portfolio/page.tsx` | Lists loans where `positionAdapter.ownerOf(loanId)==user` | `LendingMarketV2.getLoanDetails` | `LoanService`, `UserController` | ✅ Functional |
| **12. Account / Alerts** | `app/account/page.tsx` | Email/SMS/push preferences, `AlertService` `AlertService.ts`, `HealthMonitoring` | — | `AlertService`, `MonitoringServiceV2` (60s cron) | ✅ Functional |
| **13. Adapter Discovery** | `app/adapters/page.tsx` + `components/adapters/` | `AdapterSelector`, `AdapterCard`, `AdapterBadge` — **hardcoded from `contracts.ts`** not on-chain `AdapterRegistry` reads | `AdapterRegistry` (not queried) | — | ⚠️ Gap — registry not surfaced |
| **14. Docs / LLM** | `app/docs/[[...mdxPath]]/page.tsx`, `app/llm.txt/route.ts` | Nextra docs, `ADAPTER_DEVELOPER.md` canonical, `llms.txt` | — | — | ✅ Functional |

---

## 4. Map Every Market-Creation Step

### 4.1 Wizard Sequence (`web/src/app/create-market/page.tsx`)

```
Step 1 — Collateral Asset                page.tsx:340:412  (WIZARD_STEPS[0])
  ├─ AdapterSelector ASSET (ERC20/ERC721/B20AssetAdapter)  346:359
  ├─ adapterSupportsPicker(addr,chainId) → auto-open SupportedAssetPicker modal  354
  ├─ SupportedAssetPicker (curated: USDC/WETH + 13 B20 stocks on 84532)  680:689
  │   └─ handlePickerSelect: if B20 → getSuggestedAdaptersForB20() auto-fills full stack 108:124
  │                if Robinhood → getSuggestedAdaptersForRobinhood() 126:141
  ├─ TokenAddressInput (manual paste fallback) 393:400
  ├─ useTokenMetadata(collateralAsset) validation  49:53
  └─ B20 detection banner: feed, TRV 24/5, heartbeat 90000s, PolicyRegistry 0x3f3E…5CaD 401:410

Step 2 — Oracle                         page.tsx:414:435
  ├─ AdapterSelect ORACLE (Chainlink / UniswapV3TWAP / ChainlinkEquityFeedAdapter)  425:433
  └─ B20 warning: TWAP has no B20 pools → ChainlinkEquityFeedAdapter required  420:424

Step 3 — Compliance                     page.tsx:437:467
  ├─ Toggle enableCompliance  444:459
  └─ Note: no compliance adapter deployed placeholder (amber banner) 461:465

Step 4 — Liquidation                    page.tsx:469:485
  └─ AdapterSelect LIQUIDATION (DEXSwap / NFTAuction)  475:483

Step 5 — Position                       page.tsx:487:503
  └─ AdapterSelect POSITION (Standard / Soulbound / Transferable)  493:501

Step 6 — Risk Parameters                page.tsx:505:566
  ├─ LTV (1-95%)  511:516  → ltvBasisPoints = ltv*100  225
  ├─ APR (0-100%)  519:526 → aprBasisPoints = apr*100  226
  ├─ Duration (1-365 days) 529:536 → durationSeconds = days*86400  215
  ├─ Grace Period (hours) 538:544 → gracePeriodHours  228
  └─ Health Factor toggle + threshold (default 120%)  546:564 → healthFactorThreshold 230

Step 7 — Lending Asset & Liquidity     page.tsx:568:593
  ├─ TokenAddressInput lendingAsset (default USDC per chain) 574:581
  └─ Initial Liquidity (tokens, 6 decimals USDC → parseUnits(liquidity,6) 239)  584:590

Step 8 — Deploy Review & Confirm        page.tsx:595:639
  ├─ Summary card (collateral, adapters, LTV/APR/duration, lending asset, liquidity) 614:636
  ├─ B20 risk disclosure (US persons ineligible + escrow dividends) 601:612
  └─ handleDeploy()  198:283
       ├─ validateConfig() 146:196  (collateral isContract, lendingAsset allowlisted, LTV/APR bounds,
       │                              Robinhood chain provider-catalog gate 154:161,
       │                              sequencer feed fail-closed 156:161)
       ├─ builds MarketConfig struct 216:236
       ├─ b20Config {feed, maxStaleness=90000, l2Sequencer=BASE_SEQUENCER_FEED} 242:250
       ├─ robinhoodProviderConfig encodeAbiParameters(feed,86400,sequencer) 253:261
       └─ useContractInteraction.createMarket(config,factory,initialLiquidity,b20Config,providerConfig) 263:269
            → MarketFactoryV2.createMarket / createB20Market / createProviderMarket
```

### 4.2 On-Chain Factory Path (`MarketFactoryV2.sol:205:307`)

```
_createMarket(config, initialLiquidity, providerConfig)
  ├─ provider bundle gate 210:221  (canonicalProviderForAsset check, ProviderNotConfigured, AssetReservedForProvider)
  ├─ _validateMarketConfig 224  (lp!=0, collateral isContract, 4 adapters !=0, LTV 1-95%, APR ≤100%, duration 1h-365d)
  ├─ _validateAdapterCompatibility 225:229
  │   ├─ R1: isAllowedLendingAsset[lendingAsset] else LendingAssetNotAllowed 381:384
  │   ├─ R2: async liquidation ⇒ complianceAdapter !=0 else AsyncLiquidationRequiresCompliance 387:391
  │   ├─ R3: registry.isSelectable(adapter) for all 5 else revert "not selectable" 394:400
  │   ├─ R4: configHash duplicate ⇒ MarketAlreadyExists 403:419
  │   └─ R5: TransferablePosition+compliance hook — off-chain review-enforced (comment 422:430)
  ├─ marketDeployer.deploy(...) 231:255  (new LendingMarketV2, sets 5 adapters immutable 249:253)
  ├─ _configureAdapters(market) 257  (each adapter.configure(market,…) 314:351;
  │                                      liquidation.configureRisk(market,oracleAdapter,500) low-level call 334:338;
  │                                      positionAdapter.registerMarket(market) low-level call 343:347)
  ├─ providerConfigurator.configureMarket(...) if providerId !=0 259:268  (atomic, reverts entire create on failure)
  ├─ creationFee = initialLiquidity * 50 / 10000 (0.5%) 270
  ├─ safeTransferFrom(msg.sender→market, netLiquidity) 272
  ├─ safeTransferFrom(msg.sender→treasury, creationFee) 274
  ├─ LendingMarketV2.initializeLiquidity(netLiquidity, lpAddress) 277
  └─ registries push + configHashToMarket[hash]=market 279:301, emit MarketCreated 303
```

### 4.3 Key UX Gaps Identified in This Flow

- **No pre-deploy simulation** — validation is client-side `validateConfig` + on-chain revert, but no `eth_call` dry-run shown before wallet confirmation.
- **No creation-fee preview** — `MarketFactoryV2.calculateCreationFee` not called in UI; user sees only `liquidity` input `584` without net/fee split.
- **Adapter verification status hardcoded** — `verified:true` `73:94` from `contracts.ts` always, not `AdapterRegistry.getAdapterInfo(...).verified`.
- **Compliance step is a toggle with no adapter list** unless B20/Robinhood chain `91:95` — non-B20 compliance adapters not discoverable.

---

## 5. Record Known Bugs

### 5.1 Security Audit Findings (RedChips Pashov AI Audit 2026-07-23, `redchips-pashov-ai-audit-report-…md`)

> All 17 findings re-evaluated against **current V2** code (commit at 84532 deployment 2026-08-27). `Confidence` is original auditor score.

| # | Title | File:Line | Orig. Confidence | Current Status |
|---|-------|-----------|------------------|----------------|
| 1 | UniswapV3TWAPAdapter permissionless price manipulation | `UniswapV3TWAPAdapter.updatePrice` | 95 | **FIXED** — now `onlyFactory` `92`. Residual: price still mock (`lastPrice` set via `updatePrice`), no real `OracleLibrary.consult` integration. |
| 2 | All Position Adapters permissionless mint/burn | `Standard/Soulbound/Transferable.mint` | 95 | **FIXED** — now `onlyMarket` via `authorizedMarkets[msg.sender]` `24:58` + `registerMarket` gated by `onlyFactory`. Residual: clone `initialize` sentinel `address(0xdead)` not enforced in current Standard impl (constructor sets factory directly `37:39`). |
| 3 | ERC20Adapter confused deputy (`IERC20(msg.sender)`) | `ERC20Adapter.escrow` | 95 | **FIXED** — now `marketConfigs[msg.sender].token.safeTransferFrom` `44:48`, `onlyFactory` configure `37`. |
| 4 | ERC721Adapter confused deputy | `ERC721Adapter.escrow` | 95 | **FIXED** — same pattern. |
| 5 | LoanContract underwater ERC20 liquidation math revert | `LoanContract._liquidateERC20:95` | 95 | **LEGACY, STILL PRESENT** — V1 `LoanContract` underwater path `259:289` still uses unsafe `marketPayment` calc but now patched with ternary `273`. However V1 not used by V2; keep as **HIGH** if V1 markets still indexable. |
| 6 | LoanContract underwater ERC1155 underflow | `LoanContract._liquidateERC1155:110` | 95 | **LEGACY, PATCHED** `385` now `repaymentAmount > principal ? … : 0`. Keep **MEDIUM**. |
| 7 | LoanContract ERC1155 wrong token ID | `LoanContract._liquidateERC1155:123` | 95 | **LEGACY** — V1 only. V2 ERC1155 not supported via `IAssetAdapter` (no ERC1155 adapter exists). **MEDIUM**. |
| 8 | UniswapV3TWAPAdapter key mismatch (asset vs msg.sender) | `UniswapV3TWAPAdapter.getPrice` | 90 | **FIXED** — now `marketConfigs[msg.sender]` consistently `75`, `registerPoolForMarket(market,…)` `64`. |
| 9 | LendingMarketV2 requestLoan checks wrong balance (`lendingAsset` vs `collateralAsset`) | `LendingMarketV2.requestLoan:153` | 90 | **FIXED** `413:418` now checks `IERC20(collateralAsset).balanceOf(address(this))` delta. |
| 10 | LendingMarketV2 liquidate trusts adapter returns blindly | `LendingMarketV2.liquidate` | 85 | **PARTIALLY FIXED** — now `balanceBefore/After` verification `541:548` and `actualRecovery` clamping `547`. Residual: `returnedToHolder` not balance-verified (to holder, not market). **HIGH → MEDIUM**. |
| 11 | totalLiquidity never updated on repay/liquidate | `LendingMarketV2.repay/liquidate` | 85 | **FIXED** — `totalLiquidity += lpRevenue` `488`, and `totalLiquidity -= loss` on liquidation `555,601`. |
| 12 | MarketFactoryV2 ETH/ERC20 unit mismatch | `MarketFactoryV2.createMarket:196` | 85 | **FIXED** — now ERC20-denominated, `CREATION_FEE_BPS=50` in lending asset `37`, `initialLiquidity` explicit param `160`. |
| 13 | lastPrice updated during pause corrupts resume check | `LendingMarketV2._checkCircuitBreaker` | 82 | **FIXED** — only updates when `status==ACTIVE` `660:663`. |
| 14 | NFTOracle stale reverts blocks all liquidations | `NFTOracle.getFloorPrice` | 82 | **FIXED in V2** — oracle untrusted → `PAUSED_STALE_ORACLE` `618:623` not revert; liquidation blocked only via `NotLiquidatable` unless expired. V1 still reverts. |
| 15 | OracleRouter staleness skipped on `getLastUpdate()` revert | `OracleRouter._tryGetPrice` | 75 | **OPEN** — catch block still accepts price without staleness verification. **MEDIUM**. |
| 16 | UniswapV3TWAPAdapter permissionless pool registration | `UniswapV3TWAPAdapter.registerPool` | 75 | **FIXED** — now `onlyFactory` `64`. |
| 17 | LendingMarketV1 reserved liquidity over-reserves origination fee | `LendingMarket.requestLoan` | 75 | **LEGACY** — V1 only. V2 uses share-based accounting `318:329`. **LOW**. |

**Additional Leads (7) from same report, re-scored:**

| Lead | Current Status |
|------|----------------|
| ERC721Adapter release uses `safeTransferFrom(msg.sender,to,id)` | **FIXED** — now `marketConfigs[msg.sender].token.safeTransferFrom(msg.sender,to,amountOrId)` `52:55`, with prior `approve(max)` in `LendingMarketV2:272:274`. |
| OracleRouter `getPriceWithSource()` non-view | **OPEN** `oracles/OracleRouter.sol:290` — `external` not `view`, off-chain call overhead. **LOW**. |
| OracleRouter `configureOracleBatch()` hardcodes tertiary=0x0 + fixed 3600 | **OPEN** `oracles/OracleRouter.sol:139` — per-asset flexibility lost. **MEDIUM**. |
| LendingMarketV2 `repay()` permissionless + position mint steal | **FIXED** premise — `mint` now gated; repay remains permissionless by design `446`, collateral goes to `ownerOf(loanId)` `478` correctly. |
| `liquidate()` can skip cure window if `isAsynchronous()==false` | **FIXED** — `LendingMarketV2:504:507` reverts `LoanNotInCure` when in `LIQUIDATION_CURE` regardless of adapter type. |
| `MarketFactoryV2.createMarket()` no `nonReentrant` | **FIXED** — now `nonReentrant` `160,173,195`. |
| `IssuerRedemptionLiquidationAdapter.settleLiquidation()` trusts recoveredForLP | **PARTIALLY OPEN** — `settleLiquidation` still trusts return values; now mitigated by `actualRecovery` but async redemption proceeds not balance-verified. **HIGH**. |

### 5.2 New Bugs Found During This Audit (2026-08-28)

| ID | Severity | Title | Evidence |
|----|----------|-------|----------|
| N-01 | **HIGH** | `TransferablePositionAdapter` compliance hook not enforced on-chain (R5) | `MarketFactoryV2._validateAdapterCompatibility:422:430` is a no-op comment: "off-chain, we trust that verified adapters implement correctly." A transferable position with B20 compliance could be sold to an ineligible address if adapter is unverified. |
| N-02 | **HIGH** | `DEXSwapLiquidationAdapter` sets `deadline=block.timestamp` `160` — transaction can revert if mined even 1 block late; should be `block.timestamp + 300` | `DEXSwapLiquidationAdapter.sol:160` |
| N-03 | **MEDIUM** | `ERC20Adapter.isTransferable` checks `allowance(from, address(this))` `63` but `escrow` pulls via `token.safeTransferFrom(from, msg.sender, ...)` `47` — allowance spender mismatch. Must be `allowance(from, market)` not `allowance(from, adapter)`. Current check always fails for market-mediated escrow; UI `isTransferable` preflight is broken. | `ERC20Adapter.sol:63` vs `47` |
| N-04 | **MEDIUM** | `LendingMarketV2.withdrawLiquidity` does not check for pending `LIQUIDATION_CURE`/`LIQUIDATION_SETTLING` loans that may need liquidity for surplus payouts. LP can rug async surplus. | `LendingMarketV2.sol:336:349` |
| N-05 | **MEDIUM** | `MarketFactoryV2` stores `coolDownSeconds` typo? Check `CircuitBreakerConfig.cooldownSeconds` vs `cbConfig.cooldownSeconds` — frontend maps `cooldownSeconds` correctly `235` but docs say 4h default not enforced. | `LendingMarketV2.sol:105` |
| N-06 | **LOW** | `ChainlinkEquityFeedAdapter._isWithinTradingWindow` computes `timeOfDay` then suppresses unused warning `199` — intraday window not implemented, but comment says "kept for future". Dead code. | `ChainlinkEquityFeedAdapter.sol:198:199` |
| N-07 | **LOW** | `StandardPositionAdapter` constructor sets `factory=_factory` `37:39` but comment claims sentinel `0xdead` pattern — inconsistency with `ADAPTER_DEVELOPER.md` §5. | `StandardPositionAdapter.sol:37` |

---

## 6. Record Known Limitations

### 6.1 Protocol-Level Limitations

| # | Limitation | Impact |
|---|------------|--------|
| L-01 | **No ERC1155 collateral** — `IAssetAdapter` exists but no `ERC1155Adapter` deployed; `LoanContract` supports it but V2 does not. | Multi-token portfolios not supported. |
| L-02 | **UniswapV3TWAPAdapter is stub/MO** — `getPrice` returns `lastPrice` set via `updatePrice` `79`, not real `OracleLibrary.consult`. Manipulation resistance unproven on-chain. | Crypto-native markets rely on off-chain keeper to push prices; TWAP thesis not enforced on-chain. |
| L-03 | **No rebalancing for accrued interest** — interest accrues via `_calculateInterest` `770:784` on read, but `totalBorrowed` not updated until repay/liquidate. `getMarketStats.activeLoans` loops O(n) `735:737` — gas bomb at 1k+ loans. | Unbounded view gas; indexer must cache. |
| L-04 | **LTV hard cap 95%** `366` — no under-collateralized (≥100% LTV) markets despite PRD claiming 50-200% `214`. | Under-collateral use case blocked. |
| L-05 | **No partial repayment** — `repay` requires full `principal+interest` `456`, no `repayPartial(amount)` | UX friction, no refinancing. |
| L-06 | **No loan extension / rollover** — `durationSeconds` immutable `128`, no `extendLoan` function. | Borrowers must repay + re-borrow. |
| L-07 | **Single lending asset per market** — `lendingAsset` immutable `114`, no multi-stable support. | Markets cannot swap stable. |
| L-08 | **No liquidation incentive/bonus** — liquidation is permissionless but caller is not rewarded; `liquidate` caller only emits event `561`. Keeper must be subsidized off-chain. | No MEV/keeper auction. |
| L-09 | **Oracle trading window is Mon-Fri UTC only** `195:206` — ignores exchange holidays (NYSE close Dec 25 etc). B20 `isTrusted=false` on holidays → `PAUSED_STALE_ORACLE` false positive. | Legitimate trading day pause. |
| L-10 | **Provider asset monopoly** — `canonicalProviderForAsset` `97` reserves collateral address for one provider; generic markets cannot override. Correct for B20/Robinhood but blocks community long-tail token with same address collision (unlikely but irreversible without `setProviderAsset(...,false)`). | Governance action required to unreserve. |
| L-11 | **No upgrade path** — all adapters `immutable factory`, no proxy, no `upgradeAdapter(market,newAdapter)`. Market terms immutable. | Market cannot migrate to new oracle without redeploy. |
| L-12 | **No rate limiting on flash-loan borrow** — `requestLoan` `358:379` has no per-block or per-address throttling; TWAP stub makes this exploitable if keeper lags. | Economic attack surface. |

### 6.2 Product / UX Limitations

| # | Limitation |
|---|------------|
| L-13 | Market discovery is **client-side filter only** `markets/page.tsx:32:45` — no backend `availableLiquidity`/`borrowRate`/`risk` filters, no pagination beyond `start=0,50` `27`. Cannot answer "highest yield" or "lowest risk". |
| L-14 | No risk disclosure for **non-B20** markets — warnings only for B20 `601:612`, generic volatile ERC20 has no LTV/APR warning. |
| L-15 | No health-factor visualization before borrowing — preview card removed? Only post-loan `getHealthFactor` `682`. |
| L-16 | Adapter registry not queried — UI hardcodes `verified:true` `73:94`, `AdapterRegistry.getAdaptersByType` never called. Unverified adapters appear verified. |
| L-17 | No market-management dashboard for LPs — `withdrawLiquidity` exists but no UI for pausing, tweaking CB params, or viewing `LoanStatus` breakdown. |
| L-18 | No repay deadline countdown / grace period tooltip in borrow flow. |
| L-19 | No gas estimation fallback — `createMarket` hard-requires `safeTransferFrom` allowance; no `approve` helper in wizard step 7. |

---

## 7. Record Security Assumptions

| # | Assumption | Where Enforced | Trust Model | What Breaks It |
|---|------------|----------------|-------------|----------------|
| S-01 | **Oracle adapter isTrusted is single source of truth** for pause. | `LendingMarketV2._checkCircuitBreaker:616:664` — if `!trusted` → `PAUSED_STALE_ORACLE`. | Defense-in-depth: `MAX_SANE_PRICE=1e36` `68`, `price>0 && price<MAX` `402`. | Compromised Chainlink feed returning trusted but wrong price within sane range. |
| S-02 | **Asset adapter is trusted to move correct amount** but engine verifies balance delta. | `_requestLoan:413:418` `Escrow under-delivery`, `liquidate:541:549` `actualRecovery`. | Zero-trust: every adapter output balance-checked. | Token with fee-on-transfer / rebasing breaks delta check (must not use such collateral). |
| S-03 | **Compliance adapter fail-closed** — `catch→revert NotBorrower` `389:391`, `isEligible==false` blocks loan. | `LendingMarketV2:386:392` | Fail-closed | Adapter returning `true` unconditionally (must be caught in verification). |
| S-04 | **Liquidation adapter must be adversarial** — engine does not trust `recoveredForLP`/`returnedToHolder` return values, uses `actualRecovery`. | `542:554` | Balance verification | `returnedToHolder` not verified; surplus to holder is trustful. |
| S-05 | **Circuit breaker liveness** — requires every `requestLoan` to call `_checkCircuitBreaker` via `marketActive` `286:290`. No keeper needed for pause, but resume also requires a transaction. | `LendingMarketV2:286` | Permissionless trigger | Market idle with no txs stays paused forever (needs keeper to poke). |
| S-06 | **Interest frozen at LIQUIDATION_CURE** `528` — prevents runaway debt during async redemption. | `_calculateInterest:772:775` checks `frozenInterestAt !=0` | Deterministic | `liquidate` re-entry before `frozenInterestAt` set (guarded by `nonReentrant`). |
| S-07 | **Position ownership = collateral ownership** — `positionAdapter.ownerOf(loanId)` is single source `478,721`. | `LendingMarketV2:478` | NFT ≠ collateral alias | Transferable position sold to ineligible address (N-01). |
| S-08 | **Factory `isAllowedLendingAsset` gate** — only allowlisted stablecoins. | `MarketFactoryV2:381:384` | Governance | Malicious stable with blacklist/fee breaks invariant S-02. |
| S-09 | **Sequencer uptime checked for L2 equity feeds** — `ChainlinkEquityFeedAdapter._isSequencerUp` `215:232` with `SEQUENCER_MAX_STALENESS=3600` + `GRACE_PERIOD=3600`. | `ChainlinkEquityFeedAdapter:148` | Fail-closed on catch `230` | Sequencer feed address misconfigured → permanent `isTrusted=false`. |
| S-10 | **No reentrancy across adapters** — all state-changing entry points `nonReentrant` + CEI ordering. | `LendingMarketV2:318,336,446,497,568` | `ReentrancyGuard` | Malicious token callback re-entering adapter (mitigated: state updates before external calls `485:488`). |
| S-11 | **Provider configurator atomicity** — `configureMarket` reverts entire `createMarket`. | `MarketFactoryV2:259:268` | All-or-nothing | Configurator with side-effects not rolled back (requires configurator to be stateless or use try/catch). |
| S-12 | **US persons ineligible for B20** — documented in docs + `B20PolicyComplianceAdapter` but not enforced on-chain beyond policy registry. | `B20PolicyComplianceAdapter:105:117` | Legal + policy registry | Policy registry misconfiguration allows US borrower. |

---

## 8. Record Dependencies

### 8.1 On-Chain Dependencies

| Dependency | Version | Where Used | Risk |
|------------|---------|------------|------|
| OpenZeppelin Contracts | `^4.9.0` `contracts/package.json:63` | `ReentrancyGuard`, `Pausable`, `SafeERC20`, `IERC20Metadata`, `Address`, `Math.mulDiv`, `Initializable` | Low — audited, but `v4.9` uses `security/ReentrancyGuard` (not `utils/ReentrancyGuard` in v5) → upgrade path locked. |
| Uniswap V3 Core/Periphery | `^1.0.0` / `^1.4.0` `64:65` | `IUniswapV3Pool`, `OracleLibrary` (stubbed) | Low — but `OracleLibrary.consult` not actually called in production TWAP adapter. |
| Chainlink Contracts | `^0.8.0` `62` | `AggregatorV3Interface` in `ChainlinkAdapter` + `ChainlinkEquityFeedAdapter` + `OracleRouter` | Medium — feed liveness outside control; requires allowlisted feeds. |
| Solidity `0.8.20` | via `hardhat.config.ts:21` + `optimizer runs=20 viaIR:true` `26` | All contracts | Low. |
| Solidity `0.7.6` | `hardhat.config.ts:33` | Legacy `LendingMarket.sol`? Check artifacts | Remove if unused. |

### 8.2 Off-Chain Dependencies

| Dependency | Version | Where Used | Risk |
|------------|---------|------------|------|
| Hardhat | `^2.17.0` `52` | Compile, deploy, test, verify | Build toolchain |
| Ethers.js | `^6.16.0` backend `45` / `^6.0.0` contracts `55` | Backend indexer, Factory deploys | v6 breaking changes |
| Node.js ≥18, npm ≥9 | `contracts/package.json:68` | All | — |
| Next.js `16.1.4` + React `19.2.3` | `web/package.json:27:33` | Frontend | Canary — Next 16 is RC, wagmi 3.4 compat risk |
| viem `^2.44.4` + wagmi `^3.4.1` + `@privy-io/react-auth` `3.12` | `web/package.json:15:16` | Wallet, contract reads/writes | High — Privy auth must match wagmi connector |
| Zustand `^5.0.10` | `web/package.json:37` | `useMarketStore` wizard state | Low |
| TanStack Query `^5.90.20` | `web/package.json:22` | `useMarkets`, `useEnrichedMarkets` | Low |
| Prisma `^5.22.0` backend / `^7.3.0` web | `backend/package.json:29`, `web/package.json:14` | DB ORM | Version skew: backend 5 vs web 7 — migrate mismatch risk |
| PostgreSQL + Redis | `backend/src/services/indexer` | Indexer, cache, price_history | Infra |
| SendGrid `^8.1.6`, Twilio `^5.12`, Firebase Admin `13.6` | `backend/package.json:40:48` | `AlertService.ts` | Secrets in env; no rotation documented |
| Sentry `@sentry/node ^10.36` | `backend/package.json:41` | Error tracking | — |
| Helmet `^8.1`, CORS, express-rate-limit `^8.2` | `backend/package.json:49,32,47` | `app.ts` security | Rate limit 100 req/15min global, not per-IP for sensitive routes |
| `pino ^10.3` + `prom-client ^15.1` | `backend/package.json:51:52` | Logging, metrics | No Grafana dashboard tied to playbook C4 |
| Alchemy / RPC providers | `hardhat.config.ts:58,66` via env `SEPOLIA_RPC_URL`, `BASE_SEPOLIA_RPC_URL`, `ROBINHOOD_RPC_URL` | Deploy + indexer + `MonitoringServiceV2` | Single-point RPC failure → indexer stall |
| Basescan / Etherscan V2 API | `hardhat.config.ts:104:124` | Verify | `ETHERSCAN_API_KEY` used for both eth + base via `apiURL: https://api.etherscan.io/v2/api` |
| Docker / Railway | `backend/railway.toml` | Deploy | — |

### 8.3 Transitive / Implicit Dependencies

- `IUniswapV3SwapRouter` `DEXSwapLiquidationAdapter.sol:8` — router address set via `setRouter` `92:95` (owner-gated, not factory). If router upgrades (V3→V4), owner must rotate; no timelock.
- `PolicyRegistry` `0x3f3E…5CaD` (B20) hardcoded expectation in docs — not on-chain constant, passed as constructor param `70` correctly.
- Base L2 Sequencer `0xBCF8…6433` `ChainlinkEquityFeedAdapter` — single Chainlink feed; outage → all B20 markets paused.

---

## 9. Record Missing Documentation

| # | Missing Artifact | Playbook Requirement | Current State | Priority to Fix |
|---|-----------------|----------------------|---------------|-----------------|
| D-01 | **SDK package** (`@openasset/adapter-sdk`) | B2 — types, base contracts, helpers, error defs, test utils, example adapters, local dev instructions | **Does not exist.** Only `docs/ADAPTER_DEVELOPER.md` (excellent, 449 lines) but no npm package. Developers must copy-paste from `contracts/src/adapters/`. | P0 |
| D-02 | **Local testing environment** | B3 — mock assets, mock price feeds, mock liquidation, compliance cases, gas testing, integration test harness | `contracts/src/mocks/` has 7 mock adapters + `MockERC20/ChainlinkFeed/UniswapV3Router`, but no `docker-compose`/`anvil` script, no `npm run test:adapter <path>` CLI. `test/unit/` present but not documented for external devs. | P0 |
| D-03 | **Adapter templates per category** | B4 — ERC20 pricing, ERC20 liquidation, NFT pricing, NFT liquidation, compliance, RWA | `contracts/src/adapters/` serves as templates implicitly, but no `create-adapter --template erc20-pricing` CLI. | P0 |
| D-04 | **Submission workflow automation** | B7 — automated interface/failure/reentrancy checks | `scripts/` not audited; `manual_verify.ps1`, `fizz_data/` exist but undocumented. No CI check for `IAssetAdapter` conformance. | P1 |
| D-05 | **Verification checklist (published)** | B6 — 11-point checklist reproduced in registry but not in public docs beyond `ADAPTER_DEVELOPER.md` §7 | §7 checklist exists in dev doc but no public `VERIFICATION_POLICY.md` with auditGovernance multisig members, SLA, rejection reasons. | P0 |
| D-06 | **Core protocol spec (frozen)** | A2 — market creation, isolation, collateral/borrowing rules, interest model, LTV, liquidation, fees, permissions, emergency controls, upgrade model | `ReferenceDoc.md` (excellent, 1500+ lines) + inline natspec, but no `SPEC.md` versioned with edge cases (e.g., "what happens if sequencer down during liquidation?"). Scattered across `ReferenceDoc.md`, `PRD.md`, `LendingMarketV2.sol` comments. | P0 |
| D-07 | **Market creation UX guide** | A3 + H3 — risk checklist, adapter selection guide, launch checklist | Only inline tooltips `create-market/page.tsx:344:532`; no standalone `/docs/market-creator-guide.md` | P1 |
| D-08 | **Security baseline** | C1 — threat model, critical contracts, attack paths, monitoring reqs, incident process | `SECURITY_REVIEW_REPORT.md` (backend/frontend only, now resolved) + `SecurityRules.MD` (supabase hygiene, not protocol). No `THREAT_MODEL.md` for protocol (oracle manipulation, adapter takeover, fee grief). | P0 |
| D-09 | **Monitoring runbook** | C4 — what monitors polling interval, paging rules, pause criteria | `MonitoringServiceV2.ts`, `KeeperService.ts`, `LiquidationBotService.ts` exist but no `docs/OPERATIONS.md` with chain RPC failover, `SEQUENCER_GRACE_PERIOD` tuning, or incident drill. | P0 |
| D-10 | **Developer quick-start (read→install→template→modify→test→submit)** | D2 — single path from zero to verified adapter | `ADAPTER_DEVELOPER.md` §10 Pyth example is closest, but no `npx create-openasset-adapter` + no `time-to-first-adapter` metric. | P0 |
| D-11 | **Market discovery spec** | A4 — filters, sort, risk visibility | Only category tabs + text search `markets/page.tsx`; no spec for LTV/liquidity/APR/risk filters. | P1 |
| D-12 | **Provider bundle docs** | For operators adding B20/Robinhood | `docs/BASE_STOCKS_IMPLEMENTATION_PLAN.md`, `provider-bundle-activation-runbook.md`, `provider-bundle-implementation-report.md` exist but not linked from main README. | P1 |
| D-13 | **Deployment manifests** | Per-chain address registry | `docs/deployment-manifests/` exists, `contracts/deployments/` exists, but `contracts/deploy_base_sepolia_oracles.txt` etc. are flat files not JSON manifest with verification links. | P1 |

---

## 10. Classify Issues as Critical / High / Medium / Low

### 10.1 Consolidated Risk Register (Playbook A1 Step 10)

**Scale:** CRITICAL = fund loss / protocol brick; HIGH = exploitable under conditions / major UX break; MEDIUM = degraded functionality / gas grief; LOW = polish / dead code / non-view.

| ID | Severity | Category | Title | File:Line | Exploitability | Backlog Ticket |
|----|----------|----------|-------|-----------|----------------|----------------|
| **R-01** | **CRITICAL** | Security — Adapter Trust | Async issuer redemption liquidation trusts `recoveredForLP` without balance proof; `actualRecovery` mitigates but async settlement not re-verified | `LendingMarketV2:590:594` + `IssuerRedemptionLiquidationAdapter` | Medium — requires compromised/malicious redemption adapter + compliance gate bypass | **SEC-007** |
| **R-02** | **CRITICAL** | Security — Position Transfer | Transferable position can be transferred to ineligible address; R5 off-chain only | `MarketFactoryV2:422:430` | Medium — requires Transferable adapter without `isEligible` hook | **SEC-008** |
| **R-03** | **CRITICAL** | Security — Oracle Stub | `UniswapV3TWAPAdapter` returns last pushed price, not TWAP; single keeper can manipulate all TWAP markets | `UniswapV3TWAPAdapter:79` | High if keeper key leaked / factory owner compromised | **SEC-009** |
| **R-04** | **HIGH** | Security — Liquidation Grief | `DEXSwapLiquidationAdapter.deadline=block.timestamp` `160` → liquidation reverts one block late; underwater loans unliquidatable, bad debt accumulates | `DEXSwapLiquidationAdapter:160` | High — network congestion griefer | **BUG-012** |
| **R-05** | **HIGH** | Security — Asset Allowlist Mismatch | `ERC20Adapter.isTransferable` checks `allowance(from, address(this))` not `allowance(from, market)` `63` → UI preflight always false; user thinks loan will fail but on-chain succeeds → confusion, or vice versa with fee-on-transfer tokens | `ERC20Adapter:63` | Medium — UX + integration break | **BUG-013** |
| **R-06** | **HIGH** | Availability | Market with B20 equity feed paused every weekend/holiday (`isWithinTradingWindow` Sat/Sun → `isTrusted=false` `144:145`) blocks `requestLoan` + `getHealthFactor→0→NotLiquidatable` guard `513` prevents liquidation of expired loans? Actually expired still liquidatable `509`, but health breach blocked. | `ChainlinkEquityFeedAdapter:144` + `LendingMarketV2:509:515` | High — every B20 market pauses ~104 days/year | **LIMIT-009** |
| **R-07** | **HIGH** | Fund Safety | LP can `withdrawLiquidity` even with loans in `LIQUIDATION_CURE` that will need surplus payout; drains async surplus | `LendingMarketV2:336:349` | Medium — LP griefing / rug | **BUG-014** |
| **R-08** | **HIGH** | Protocol Invariant | `OracleRouter._tryGetPrice` catch swallows staleness check `75` → stale price used as trusted | `OracleRouter` | Medium — old feed version | **BUG-015** (orig #15) |
| **R-09** | **MEDIUM** | Correctness | `LendingMarketV2.getMarketStats` iterates all loans `735:737` — unbounded gas, breaks with 2k+ loans | `LendingMarketV2:735` | Low — view only, but indexer mirrors it | **PERF-001** |
| **R-10** | **MEDIUM** | UX — Market Creation | No fee preview, no dry-run, adapters hardcoded verified, no compliance discovery for generic chain | `create-market/page.tsx:73:96,198:239` | — | **UX-001 / UX-002 / UX-003** |
| **R-11** | **MEDIUM** | UX — Discovery | Category+search only; no liquidity/APR/LTV/risk filters | `markets/page.tsx:32:45` | — | **FEAT-001** (A4) |
| **R-12** | **MEDIUM** | Observability | `AdapterRegistry` not read by UI; unverified adapters shown verified; deprecation not surfaced | `AdapterRegistry:188:191` + `contracts.ts` | — | **FEAT-002** (B5) |
| **R-13** | **MEDIUM** | Operability | No monitoring runbook; `MonitoringServiceV2` + `KeeperService` lack paging spec (playbook C4) | `backend/src/workers/` | — | **OPS-001** |
| **R-14** | **MEDIUM** | Protocol — Missing Feature | No partial repay, no rollover/extension, LTV cap 95% blocks under-collateral thesis | `LendingMarketV2:446` + `MarketFactoryV2:366` | — | **FEAT-003 / FEAT-004 / LIMIT-004** |
| **R-15** | **MEDIUM** | Security — Sequencer | Robinhood/B20 sequencer feed misconfig → permanent pause; no fallback oracle | `ChainlinkEquityFeedAdapter:148` | Medium — config error | **OPS-002** |
| **R-16** | **LOW** | Polish | `OracleRouter.getPriceWithSource` not view, `configureOracleBatch` tertiary hardcoded, `StandardPositionAdapter` sentinel mismatch, `timeOfDay` dead code | Multiple | — | **POLISH-001..004** |
| **R-17** | **LOW** | Inventory | No ERC1155 adapter; `LoanContract` V1 still compiled but unused — remove or archive | `contracts/src/mocks/`, `LoanContract.sol` | — | **TECH-001** |

> **Counts:** CRITICAL 3 · HIGH 5 · MEDIUM 8 · LOW 1 group (4 items). This matches the 17 audit findings + 7 new + 12 limitations triage.

---

## 11. Priority Backlog (Playbook §6 Definition of Done + §30 Execution Board)

Each ticket follows `Ticket ID / Workstream / Phase / Priority / Owner / Metric / Evidence`.

### P0 — Must complete before external trust (Phase 1 gates: A2, C1, C4)

| Ticket ID | Workstream | Phase | Priority | Objective | Acceptance Criteria | Metric | Owner |
|-----------|------------|-------|----------|-----------|---------------------|--------|-------|
| **SEC-007** | C — Adapter security model (C3) | 1-2 | **P0 CRITICAL** | Close async redemption accounting gap | `settleLiquidation` verifies `balanceAfter>=balanceBefore+returnedToHolder+recoveredForLP`; add integration test with mocked redemption that returns inflated values and proves revert via `AdapterUnderDelivered` | `LendingMarketV2.t.sol` — failing test → passing | Founder + audit |
| **SEC-008** | C3 + B6 | 2 | **P0 CRITICAL** | Enforce R5 on-chain for Transferable+Compliance | Modify `TransferablePositionAdapter._beforeTokenTransfer` to call `IComplianceAdapter(complianceAdapter).isEligible(to)`; add negative test `testTransferToIneligibleReverts`; factory stores `complianceAdapter` in clone `initialize` and validates mismatch at `createMarket` | Transfer simulation fails | Founder |
| **SEC-009** | C1 | 1 | **P0 CRITICAL** | Replace TWAP stub with real `OracleLibrary.consult` or document as "mock-only" and block mainnet flag | Either implement `IUniswapV3Pool.observe` + `OracleLibrary.consult(pool, twapPeriod)` in `UniswapV3TWAPAdapter.getPrice` and `getHistoricalPrice`, or add `require(block.chainid != 8453 || !isProduction)` gate and remove adapter from allowlist on 8453 | Real TWAP fork test | Founder |
| **SPEC-001** | A2 — Lock core spec | 1 | **P0** | Freeze protocol spec as versioned doc | New `docs/SPEC.md` covering §A2 13 items (market creation, isolation, collateral/borrowing, interest `aprBps*elapsed/365d`, LTV 1-95%, liquidation state machine, fees 0.5% + 10% revenue, 5 adapter interfaces, permissions, emergency `pause/unpause` `668:678`, no-upgrade model), edge cases (sequencer down, weekend equity, fee-on-transfer blacklist) | `SPEC.md` reviewed by 2 engineers, used as implementation reference for next PR | Founder |
| **SEC-001** | C1 — Security baseline | 1 | **P0** | Threat model + critical path registry + monitoring reqs + incident process | `docs/THREAT_MODEL.md` (STRIDE per market/adapter/oracle), `docs/INCIDENT_RESPONSE.md`, `backend/SECURITY_NOTES.md` updated, `MonitoringServiceV2` alert thresholds documented | Checklist from B6 §11 (11 items) mapped to mitigations | Founder |
| **OPS-001** | C4 — Monitoring | 1 | **P0** | Make markets observable | Grafana/prom-client dashboards for `MarketCreated`, `LoanCreated/Repaid/Liquidated`, `CircuitBreakerTriggered`, `AdapterVerify`, `balanceDelta` alerts; `KeeperService` liveness probe with PagerDuty; runbook `docs/OPERATIONS.md` | % markets with healthy indexer lag <30s | Founder |
| **BUG-012** | C3 | 1 | **P0 HIGH** | Fix DEXSwap deadline grief | Change `deadline: block.timestamp` → `block.timestamp + 900` (15 min) or make `maxSlippageBps`-derived; add test that liquidation succeeds when mined 2 blocks late | Existing `DEXSwapLiquidationAdapter.test.ts` — add late-block case | Founder |
| **BUG-013** | A2 | 1 | **P0 HIGH** | Fix `isTransferable` allowance spender | Change `allowance(from, address(this))` → `allowance(from, msg.sender)` (market) or `allowance(from, marketConfigs[msg.sender].token)` stored; update `MockERC20` approvals in tests | UI preflight matches on-chain | Founder |
| **DOC-001** | D1 — Developer docs | 2 | **P0** | Make `ADAPTER_DEVELOPER.md` discoverable + add verification policy | Publish `docs/VERIFICATION_POLICY.md` (governance multisig, SLA, rejection taxonomy), link from `README.md` + `docs/` index, add `openasset-published-adapters.md` with verified list | Dev can answer "how to get verified?" without asking founder | Founder |

### P1 — Must complete before developer ecosystem can self-serve (Phase 2 gates: B1-B7, D1-D3)

| Ticket ID | Workstream | Phase | Priority | Objective | Acceptance Criteria | Owner |
|-----------|------------|-------|----------|-----------|---------------------|-------|
| **SDK-001** | B2 — SDK | 2 | **P1** | Publish `@openasset/adapter-sdk` | Package installs, `npx create-openasset-adapter --type oracle` scaffolds `PythOracleAdapter` from §10 example, `npm test` passes locally, `npm run build` typechecks, README with install→template→modify→test→submit | Founder |
| **ENV-001** | B3 — Test env | 2 | **P1** | Local adapter test harness | `anvil` + `scripts/test-adapter.sh <adapter.sol>` runs happy path + multi-tenancy + adversarial + liquidation reconciliation; gas report; documented in `docs/ADAPTER_TESTING.md` | Founder |
| **TMPL-001** | B4 — Templates | 2 | **P1** | One working template per priority category | `templates/erc20-pricing`, `erc20-liquidation`, `nft-pricing`, `nft-liquidation`, `erc3643-compliance`, `b20-compliance` each with `test/` + `README` | Founder |
| **REG-001** | B5 — Registry UX | 2 | **P1** | Surface registry truth in UI | `AdapterSelect` reads `AdapterRegistry.getAdapterInfo(adapter).verified/deprecated`; deprecated adapters disabled with warning; verified badge matches on-chain | FE |
| **UX-001** | A3 — Market creation UX | 1 | **P1** | Fee preview + dry-run | Step 8 calls `MarketFactoryV2.calculateCreationFee(initialLiquidity)` and renders `netLiquidity` vs `creationFee`; `publicClient.simulateContract(createMarket)` preflight with revert decoding via `decodeContractError` | FE |
| **BUG-014** | SEC | 2 | **P1 HIGH** | Guard LP withdraw with active cure | `withdrawLiquidity` reverts if any loan in `LIQUIDATION_CURE/SETTLING` and `availableLiquidity - amount < maxSurplusReserve`; add view `reservedForSettling()` | Founder |
| **BUG-015** | SEC | 2 | **P1 HIGH** | Fix OracleRouter staleness skip | `_tryGetPrice` on catch → `isTrusted=false` not accept; unit test with reverting `latestRoundData` proves stale rejected | Founder |

### P2 — Growth / polish (Phases 3-5)

| Ticket ID | Phase | Priority | Objective |
|-----------|-------|----------|-----------|
| **FEAT-001** | 5 | P1 | Market discovery filters (asset type ✓, LTV, liquidity, APR, verified adapters, activity) — playbook A4 |
| **FEAT-002** | 2 | P1 | Adapter versioning + usage stats (`totalValueSecured` already in `AdapterInfo:35` but never written) |
| **FEAT-003** | 5 | P2 | Partial repayment + loan extension (requires interest accounting change) |
| **FEAT-004** | 6 | P2 | LTV >95% / under-collateral flag with enhanced monitoring |
| **FEAT-005** | 3 | P1 | First-party bounty list + hackathon kit (`D6`) |
| **OPS-002** | 1 | P1 | Robinhood/B20 sequencer fallback: if `l2Sequencer==0x0` on L1 skip check; document per-chain config matrix |
| **POLISH-001..004** | 2 | P2 | View modifiers, batch tertiary fix, sentinel consistency, dead code removal |

---

## 12. Acceptance Criteria (Playbook A1)

| Criterion | Evidence | Status |
|-----------|----------|--------|
| Complete system map exists | §1 lists 10 core contracts + 14 adapters + 5 interfaces + 2 providers (§1-2); §3 maps 14 user flows with entry/steps/contracts; §4 maps 8 wizard steps + factory internal path with file:line | ✅ PASS |
| Critical issues are identified | §5.1-5.2 + §10 R-01:03 CRITICAL with file:line, exploitability, and fix sketch | ✅ PASS |
| Known limitations are documented | §6 L-01:12 protocol + L-13:19 product, each with impact | ✅ PASS |
| Priority backlog exists | §11 P0 (9 tickets), P1 (7), P2 (7) with TicketID/Workstream/Phase/Priority/Objective/Acceptance/Metric/Owner | ✅ PASS |

---

## 13. Next Step Recommendation

**A1 is READY for REVIEW.** To move to **A2 — Lock the core protocol specification**:

1. Founder signs off on severity ratings (§10) — especially **R-03** (TWAP stub) which is the single largest trust blocker for crypto-native markets on Sepolia/Base Sepolia today.
2. Create GitHub board `BACKLOG → READY → IN PROGRESS → REVIEW → BLOCKED → DONE` and import §11 tickets (use `Ticket ID` as issue key).
3. Immediately schedule **SEC-009 / BUG-012 / BUG-013** as the 3-day sprint before any external demo — all are one-line fixes with outsized trust impact.
4. Begin `docs/SPEC.md` (SPEC-001) using this audit §§1-7 as input; this spec becomes the frozen reference for the external security review (C2).

---

## Appendix — File Index Used

- `contracts/src/LendingMarketV2.sol` (803 lines) + `MarketFactoryV2.sol` (528) + `AdapterRegistry.sol` (217) + `LoanContract.sol` (543)
- `contracts/src/adapters/{asset,oracle,liquidation,position,rwa}/` (14 adapters)
- `contracts/src/interfaces/adapters/` (6 interfaces) + `oracles/` (2) + `libraries/` (2)
- `contracts/package.json`, `hardhat.config.ts`, `test/{unit,integration,fizz}`
- `web/src/app/{create-market,markets,borrow,repay,supply,portfolio,adapters}/page.tsx` + `components/adapters/*` + `lib/contracts.ts` + `lib/b20.ts` + `store/useMarketStore`
- `backend/src/services/{MarketService,LoanService,MonitoringServiceV2,KeeperService,LiquidationBotService,AlertService}`
- `docs/ADAPTER_DEVELOPER.md` (449), `ReferenceDoc.md`, `PRD.md`, `ImplementationPlan.md`, `SecurityRules.MD`, `SECURITY_REVIEW_REPORT.md`, `redchips-pashov-ai-audit-report-….md`
- `web/src/lib/contracts.ts:28` on-chain address manifest; `hardhat.config.ts:42:101` network matrix
