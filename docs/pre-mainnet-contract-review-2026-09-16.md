# Pre-Mainnet Contract Review — OpenAsset
**Date:** 2026-09-16 · **Method:** etherscan-contract-review skill (etherscan-cli v1.1.1) · **Source of record:** verified deployments on Base Sepolia (84532), cross-checked against local mainnet-bound source `contracts/src/`. All retrieved content treated as untrusted data. This is a developer-oriented review, **not** a security audit.

## Coverage

| # | Contract | Etherscan verified? | Deployed==local? | Review basis |
|---|---|---|---|---|
| 1 | AdapterRegistry | ✅ 84532 | ❌ storage-layout divergent (local adds metadata/review-status) | retrieved + local |
| 2 | MarketFactoryV2 | ✅ 84532 | ❌ local adds Rule 6 | retrieved + local |
| 3 | MarketDeployer | ✅ 84532 | ✅ identical | retrieved |
| 4 | LendingMarketV2 | ✅ 84532 | ❌ local adds ERC721-approval detection in initialize | retrieved + local |
| 5 | ERC20Adapter | ✅ 84532 | ❌ local adds configure-validation + events | retrieved + local |
| 6 | ERC721Adapter | ❌ nowhere | n/a | **local only** |
| 7 | B20AssetAdapter | ✅ 84532 | ✅ identical (comments only) | retrieved |
| 8 | ChainlinkAdapter | ❌ unverified on all chains | n/a | **local only** |
| 9 | UniswapV3TWAPAdapter | ✅ 84532 | ✅ identical | retrieved |
| 10 | ChainlinkEquityFeedAdapter | ✅ 84532 | ✅ identical | retrieved |
| 11 | DEXSwapLiquidationAdapter | ✅ 84532 | ❌ local adds per-market routing + events | retrieved + local |
| 12 | NFTAuctionLiquidationAdapter | ❌ (deployed = old stub) | n/a | **local only** (v2 rewrite) |
| 13 | B20PolicyComplianceAdapter | ❌ | n/a | **local only** |
| 14 | ManagedAllowlistComplianceAdapter | ❌ (RH testnet only; chain 46630 unsupported by Etherscan API) | n/a | **local only** |
| 15 | B20ProviderConfigurator | ❌ | n/a | **local only** |
| 16 | RobinhoodProviderConfigurator | ❌ (RH testnet only) | n/a | **local only** |
| 17 | StandardPositionAdapter | ✅ 84532 | ✅ identical | retrieved |
| 18 | SoulboundPositionAdapter | ✅ 84532 | ✅ identical | retrieved |
| 19 | TransferablePositionAdapter | ✅ 84532 | ✅ identical | retrieved |

Retrieved bundles: `Temp/opencode/etherscan/sources/` (per-contract verified standard-JSON input).

## CRITICAL — must fix before mainnet

| # | Finding | Contract | Detail | Status |
|---|---|---|---|---|
| C1 | **SoulboundPositionAdapter cannot mint** — `_beforeTokenTransfer` requires `to == address(0)` on every hook call including `_safeMint`, which always passes `to = recipient` ⇒ every borrow in a Soulbound market reverts. Markets using the default compliance-paired adapter are dead at origination. | SoulboundPositionAdapter:81-88 | Fix: `require(from == address(0) || to == address(0), "Soulbound: transfer not allowed")` + regression test mint/burn through real OZ ERC721. Present in deployed AND local code. | ✅ **FIXED** (mint/burn permitted, transfers still blocked; `PositionAdapters.test.ts`) |
| C2 | **`repayPartial` interest-wipe exploit** — partial branch resets `loan.startTime = now` even when payment < accrued interest; repeated dust payments permanently erase accrued interest (LP revenue theft, trivially exploitable). | LendingMarketV2:619-629 (local-only feature) | Fix: never reset `startTime` when `principalPaid == 0`; account for paid-vs-accrued interest in CURE. | ✅ **FIXED** — partial repayments must now cover the full accrued revenue first (`"Repay covers accrued interest first"`); dust-wipe impossible |
| C3 | **`repayPartial` on CURE double-charges** frozen interest + 5% penalty (already-paid revenue is re-charged at final close-out). | LendingMarketV2:563-634 | Same fix surface as C2 — record paid revenue against the frozen debt. | ✅ **FIXED** — CURE re-freezes (`startTime = frozenInterestAt = now`) after full revenue payment; final close-out charges only remaining principal + fresh 5% penalty |
| C4 | **ERC721 collateral path is broken end-to-end in the V2 engine** (if NFT markets are in mainnet scope): (a) LendingMarketV2 lacks `onERC721Received` → `safeTransferFrom` escrow reverts; (b) escrow invariant compares NFT balance-count delta (1) to `collateralAmount` = tokenId (fails for tokenId ≥ 2); (c) valuation multiplies tokenId as a quantity. | LendingMarketV2:466-481, ERC721Adapter:64 | If NFT collateral ships on mainnet: add receiver, make invariant asset-type-aware (delta==1), NFT-aware valuation. Otherwise: explicitly disable ERC721 collateral markets for launch and the C-fixes above become non-blocking. | ⏳ **OPEN — scope decision pending** |

Post-fix status: `H4` (cancelRegisteredOrder) also **fixed** (market+loanId passed explicitly, order↔loan binding enforced, Seaport cancel invoked — `MockSeaport` test). Regressions: 39/39 Hardhat suites + `forge build` clean.

## Fix batch 2 (all findings below addressed; 59/59 Hardhat + forge clean)

| Finding | Fix |
|---|---|
| H2 router drain authority | Owner-managed router **allowlist** (`addApprovedRouter`/`removeApprovedRouter` with code check); `setRouter`/`setMarketRouter` require allowlisting |
| H3 order-hash trust | `registerOrder` now takes full `OrderComponents`, verifies offerer/offer/consideration routing (NFT identity, lending-asset-only, ≥debtOwed to market, surplus to holder) and **derives the Seaport canonical order hash on-chain** (EIP-712 typehashes) |
| H5 blanket conduit approval | Revoked after native sale (re-granted on next handoff) |
| H6 B20 release stranding | `release()` pre-checks sender/receiver/executor policies (`B20ReleaseUnauthorized`); new `isReleaseable` view |
| H7 unbounded staleness | `MAX_STALENESS_SECONDS = 24h` cap in both provider configurators |
| M1 fail-open finalize | `claimSettlement` now mandatory (`SettlementNotClaimed`); settle-time `settleBalance` snapshot for correct delta + grief-resistant recovery accounting; NFT adapter implements `claimSettlement` (SOLD or Seaport-sold ack, `SettlementNotReady` otherwise) |
| M2 scan truncation | O(1) `reservedSettling` aggregate (increment at SETTLING entry, decrement at finalize); 500-scan deleted |
| M3/M4 | `initialize` validates treasury/adapters/LTV/duration/HF-threshold/CB-config |
| M6 clone fallback | Silent tolerance replaced with `require(success)` |
| M7 remap risk | One-time-config guards on ERC20/ERC721/B20 adapters |
| M8 template init | `_disableInitializers()` on all three position-adapter templates (tests now clone via EIP-1167) |
| M9 events | FeedRegistered/TradingWindowUpdated/OwnerTransferred/ConfiguratorUpdated (equity feed), TokenRegistered/OwnerTransferred/ConfiguratorUpdated (B20 compliance), FallbackPriceUpdated (TWAP), MarketPaused, B20 asset escrow/release/config events |
| M12 B20 probe | `configure` rejects tokens without the B20 policy surface (`InvalidB20Token`) |
| M14 getHistoricalPrice | Explicit NatSpecs marking both as informational-only |
| M15 Seaport `cancel` return | Interface now returns nothing (1.5); auction decay uses recorded listing window |

### Remaining (spec/ops level — no code action in this batch)
- M5 `GRACE_PERIOD` status is dead — decide whether to implement grace semantics or remove before mainnet
- M10 rebasing/FoT collateral — restrict selection at factory/ui level
- M11 single-key owners — deploy owners/treasury as multisig; prefer 2-step + timelock
- M13 weekend gating is day-of-week only — operational policy, not code
- H9 provenance — handled at deploy: verify every mainnet deployment at deploy time

## HIGH

| # | Finding | Contract |
|---|---|---|
| H1 | Permissionless adapter registration + registry `verified` flag is advisory-only (nothing on-chain consumes it); the engine fully trusts oracle `getPrice` outputs → hostile oracle market can harm later LPs. Mitigation: registry must be treated as a UI gate; only feature verified adapters; consider on-chain verified-gate. | AdapterRegistry + MarketFactoryV2 |
| H2 | DEXSwap `setRouter`/`setMarketRouter` = total asset-drain authority (approves full collateral to any code-bearing address); single-key owner, one-step transfer. Recommend timelock/allowlist on routers. | DEXSwapLiquidationAdapter |
| H3 | NFT adapter registers any order hash — nothing binds it to consideration routing debtOwed→market. Operator compromise ⇒ underpaid liquidations (loss recognized as write-off). Recommend storing OrderComponents and recomputing the canonical Seaport hash on-chain. | NFTAuctionLiquidationAdapter:registerOrder |
| H4 | **Bug:** `cancelRegisteredOrder` reads `marketConfigs[msg.sender]` but is `onlyOperator` ⇒ `config.seaport` is always 0 ⇒ on-chain Seaport cancel is permanently dead (masked by try/catch). Fix: take `market` as a parameter. | NFTAuctionLiquidationAdapter |
| H5 | Blanket, never-revoked `setApprovalForAll` to OpenSea conduit covers all NFTs the adapter holds across markets; revoke after sale / isolate per market. | NFTAuctionLiquidationAdapter |
| H6 | B20 release-path policy failures (market not sender-authorized, recipient/liquidation-adapter not receiver-authorized at release time) revert `repay`/liquidation and strand collateral — no release-direction pre-check. Pre-authorize market + liquidation adapter on B20 tokens operationally; consider `isReleaseable` pre-check. | B20AssetAdapter |
| H7 | Unbounded caller-supplied `maxStaleness` (no cap) via permissionless `createProviderMarket` — a creator can disable staleness detection entirely; feed identity also unvalidated on-chain. Add on-chain cap + feed-asset binding. | B20/RobinhoodProviderConfigurators, ChainlinkEquityFeedAdapter |
| H8 | TWAP reality: on-chain consult is disabled in v2.1 (verified in deployed source) — keeper-pushed `lastPrice` IS the primary oracle for crypto markets, with 1h staleness, no deviation bounds. Header docs overstate. Keeper/factory key = price authority. | UniswapV3TWAPAdapter |
| H9 | Unverified deployed artifacts: ChainlinkAdapter, ERC721Adapter, NFTAuctionLiquidationAdapter, B20PolicyComplianceAdapter, B20ProviderConfigurator, (ManagedAllowlist + RobinhoodConfigurator on 46630, chain unsupported by Etherscan). Mainnet must deploy fresh with bytecode verification. | provenance |

## MEDIUM (fix or explicitly risk-accept)

| # | Finding | Contract |
|---|---|---|
| M1 | `finalizeRedemptionSettlement` fail-open: tolerated `claimSettlement` failure + balance-delta-only accounting ⇒ donation-forced early finalization with arbitrary write-off. | LendingMarketV2 |
| M2 | Withdrawal reserve scan capped at 500 loans; truncation branch is dead code; overflow → `totalLiquidity -= shortfall` underflow can brick finalization; ~1M gas scan cost. | LendingMarketV2 |
| M3 | Circuit-breaker misconfiguration can permanently pause a market (no admin override; `resumeThresholdBps==0` disables resume). Validate `cbConfig` in `initialize`. | LendingMarketV2 |
| M4 | `initialize` validates nothing (zero treasury bricks all repay; adapters zero → dead market); factory must init atomically with deployment. | LendingMarketV2 |
| M5 | `GRACE_PERIOD` status + `gracePeriodHours` are dead — loans liquidatable 1s after expiry; `ORIGINATION_FEE_BPS` declared never used. Spec alignment needed. | LendingMarketV2 |
| M6 | Silent position-adapter clone fallback + swallowed `registerMarket` failure — market can deploy with unregistered position adapter (all loan ops revert, no signal). Make it fail-fast. | MarketFactoryV2 |
| M7 | Adapter `configure()` can re-map a live market's token (factory-key compromise blast radius). Add one-time-config guard on all asset adapters. | ERC20/ERC721/B20AssetAdapter |
| M8 | Position-adapter templates don't call `_disableInitializers()` — template can be initialized by anyone (currently contained; fix for hygiene). | all 3 position adapters |
| M9 | Missing events: ChainlinkEquityFeedAdapter + B20PolicyComplianceAdapter (zero events), TWAP `updatePrice` unevented, position adapters mint/burn unevented, market `pause()` unevented, B20AssetAdapter none. Add before mainnet. | multiple |
| M10 | Rebasing collateral can make `release()` revert (stranded collateral); FoT lending asset unaccounted on deposit/repay. Restrict collateral selection; document. | LendingMarketV2 + adapters |
| M11 | Immutable single-key owners (factory, adapters) — deploy owner as multisig + 2-step/timelock where supported. | MarketFactoryV2, adapters |
| M12 | B20 configure accepts non-B20 tokens (no probe); ERC20 probe rejects ERC20s without `decimals()`. | B20AssetAdapter, ERC20Adapter |
| M13 | Weekend/holiday equity gating is day-of-week only; Monday-reopen gap priced at Friday close if feed re-stamps; B20 path makes sequencer feed optional (Robinhood path mandates it). | ChainlinkEquityFeedAdapter, B20ProviderConfigurator |
| M14 | getHistoricalPrice always-0 (TWAP) / ungated (Chainlink) — circuit breaker keeps its own 2-point baseline; document or gate. | oracles |
| M15 | Seaport interface declares `cancel() returns (bool)` but Seaport 1.5 returns nothing — ABI-decode revert masked by try/catch; fix interface. Mid-auction `setAuctionParams` warps the decay curve (snapshot duration at listing). | ISeaport / NFTAuctionLiquidationAdapter |

## LOW / informational
Governance single-step transfers everywhere; no unregister for registry; `B20MarketInitialized` declared-never-emitted; `LendingAssetRemoved` unindexed; duplicate-config hash omits grace/HF/cb params; share-rounding dust; `getMarketStats` >1000 loans reverts vs doc; FoT collateral waste (safe); `ownerOf(0)` semantics divergence; Standard adapter silent re-mint overwrite; stale NatSpecs (B20 allowance docstring, TWAP header); dead storage `orderComponents`; no event on Seaport-side sales (state desync after OpenSea sale).

## Verified-vs-local corrections
The deployed testnet set is **older** than local for: AdapterRegistry (layout-incompatible), MarketFactoryV2 (Rule 6), LendingMarketV2 (ERC721 approval detection), ERC20Adapter (validation/events), DEXSwap (per-market routing/events). **All mainnet deployments must come from local source; never redeploy the retrieved testnet artifacts.** Conversely, deployed versions of SoulboundPositionAdapter/MarketDeployer/UniswapV3TWAP/ChainlinkEquityFeed/B20AssetAdapter/position adapters are byte-equivalent to local.

## Mainnet deployment checklist (derived)
1. Fix C1 (Soulbound hook), C2/C3 (repayPartial accounting) — code changes + tests.
4. Decide NFT-collateral scope: fix C4 or disable ERC721 markets at launch.
2. Fix H4 (cancelRegisteredOrder bug) + M15 (Seaport interface + auction-duration snapshot).
3. Redeploy: fresh AdapterRegistry (incompatible layout), LendingMarketV2 template + MarketDeployer, MarketFactoryV2 (Rule 6), all adapters; verify every deployment on Etherscan at deploy time.
4. Owner/treasury = multisig; 2-step + timelock where possible.
5. Pre-flight: `addLendingAsset` for USDC/USDT/USDG per chain, register + verify all adapters, authorize provider configurators on the adapters (`setAuthorizedConfigurator`), set DEX routers (Aerodrome Slipstream on Base, Uniswap V3 on RH), NFT adapter operator + Seaport config.
6. Indexers must gate markets on `MarketFactoryV2.isMarket` (rogue clones are eventless and indistinguishable by address).
7. Operationally pre-authorize B20 market + liquidation adapter addresses on B20 tokens (H6) and cap `maxStaleness` (H7).
