# OpenAsset Provider-Bundle Activation Runbook

**Scope:** Base B20 and Robinhood Stock Token lending markets
**Current state:** Source implementation is in review; no deployment, database migration, or live transaction has been performed.
**Recommended order:** Review and merge first, then activate one network at a time with an explicit approval checkpoint before every irreversible step.

## What can be done without user approval

Read-only RPC checks, source review, local compilation, unit/integration tests, fork or read-only live-state checks, pool discovery with `getPool`, contract-code checks, preparing environment templates, writing deployment scripts, committing source changes, and opening a pull request can be performed without transmitting a transaction or changing production state.

## What requires explicit user approval

The following actions require an explicit go-ahead in the current conversation because they change persistent or live state: deploying or redeploying contracts, sending any owner/governance transaction, setting provider configurators or provider asset reservations on a live factory, configuring a live liquidation router or pool fee, creating a live market, supplying liquidity, borrowing, applying the Prisma migration to a real database, or publishing the frontend/backend configuration that points users at new live deployments.

A useful rule is simple: **verification is usually safe to perform now; execution requires approval.**

## Current read-only Robinhood findings

The official public RPC responded with chain ID `4663`. The canonical AAPL token has code, `decimals() = 18`, `oraclePaused() = false`, and a live `uiMultiplier()`. The verified Chainlink proxy has code, eight decimals, description `Robinhood AAPL / USD`, and a positive latest answer at the time of the probe. These values are recorded in [`provider-bundle-read-only-verification.md`](./provider-bundle-read-only-verification.md).

The official Uniswap v3 factory and SwapRouter02 addresses are code-bearing on Robinhood Chain. Read-only `getPool` checks found the following AAPL pools against the official USDG and WETH addresses:

| Pair | Fee | Pool | Code | Current liquidity observation |
| --- | ---: | --- | --- | ---: |
| AAPL/USDG | 100 | None | — | — |
| AAPL/USDG | 500 | `0xaae0d815ee56e4092a5e5c2911e676fea50b2d6d` | Yes | Nonzero |
| AAPL/USDG | 3000 | `0x783c9bbb765047cfdd2b84b92b2ca9f11d34b7ed` | Yes | Nonzero |
| AAPL/USDG | 10000 | `0x3714aa8105de1f384481b425788af413748c1837` | Yes | Nonzero |
| AAPL/WETH | 100 | `0xe4d4ba605b042054bd8815d515d98ddf46232622` | Yes | Zero at probe time |
| AAPL/WETH | 500 | `0x8bb3514e2204e1cdf3ac149efee7ff04d91b719f` | Yes | Nonzero |
| AAPL/WETH | 3000 | None | — | — |
| AAPL/WETH | 10000 | None | — | — |

This answers the pool-fee discovery question, but it does **not** authorize choosing a production fee tier. The current OpenAsset liquidation adapter performs a single-hop exact-input swap into the market’s configured lending asset. If the lending asset is USDG, the candidate fees are 500, 3000, and 10000; the final choice must be based on quote simulation, depth for expected liquidation sizes, slippage, and risk review. A WETH pool cannot be used for a USDG lending market without changing the liquidation route architecture.

## Phase 1 — Review and merge the pull request

Review the provider-neutral core, factory reservation model, Robinhood configurator, compliance boundary, cross-decimal math, frontend catalog restrictions, backend provider metadata, and the release blockers in this runbook. Confirm that the pull request is merged only after the tests and deployment checklist are acceptable.

The PR intentionally does not include live addresses for an unverified Robinhood lending stablecoin or sequencer health contract. The source uses fail-closed configuration rather than silently selecting an asset or disabling L2 safety.

## Phase 2 — Prepare a per-network deployment manifest

Create a versioned, reviewable manifest outside source control for each deployment target. Do not put a private key in the manifest. At minimum, record:

| Field | Base B20 | Robinhood |
| --- | --- | --- |
| Chain ID | 8453 for production; 84532 only for explicit mocks | 4663 |
| Lending asset | Official Base USDC, 6 decimals | A verified lending asset; official docs currently list USDG, so do not label it USDC until verified and product-approved |
| B20 policy registry | Verify code and official address | Not applicable |
| Stock token | Canonical B20 token(s) | Canonical Robinhood token(s) from the live issuer registry |
| Chainlink feed | Matching B20 total-return proxy | Matching Robinhood tokenized-equity proxy |
| Sequencer health | Verified Base uptime feed | Verified official/provider-supplied Robinhood health contract; deployment remains blocked if absent |
| Liquidation router | Verified Base Uniswap router | Official Robinhood SwapRouter02 `0xcaf681a66d020601342297493863e78c959e5cb2`, subject to code and route verification |
| Pool fee | Verified per token/lending-asset pool | AAPL/USDG candidate 500, 3000, or 10000 pending quote/depth selection |
| Compliance | B20 policy and legal controls | Managed allowlist plus external KYC/KYB, sanctions, jurisdiction, and issuer review |
| Interest model | Must be reviewed before live borrowing | Must be reviewed before live borrowing |

The manifest must include a provenance URL, verification timestamp, decimals, token/feed code checks, pool address, fee tier, expected liquidation size, quoted output, and the approving reviewer. The provider catalog should remain limited to assets with a completed manifest.

## Phase 3 — Resolve the remaining Robinhood release gates

First, decide whether OpenAsset will lend **USDG** or another verified asset on Robinhood Chain. The user-facing product requirement says USDC, but the official Robinhood contract documentation read during this review listed USDG and WETH as canonical contracts. This must be resolved at the product and treasury level rather than guessed from a ticker.

Second, obtain and verify the Robinhood Chain sequencer health contract. The public documentation exposes a sequencer feed stream, but the lending oracle requires an on-chain `AggregatorV3Interface`-compatible uptime contract. Do not substitute the websocket stream address into the Solidity configuration. Until the on-chain address is verified, leave Robinhood provider deployment disabled.

Third, simulate the liquidation route read-only. For each candidate USDG fee tier, use QuoterV2 and the actual AAPL amount ranges expected from liquidation. Record amount-out, price impact, and whether the output exceeds the oracle-derived minimum after the configured slippage bound. The current local adapter uses `poolFee` and `maxSlippageBps`, so the selected fee must be written into the live market configuration after market creation by the adapter owner.

Fourth, verify that the actual lending asset, AAPL token, router, pool, and feed all have code and compatible decimals; verify the token ordering and pool state; verify that the router supports the exact-input-single call used by the adapter; and verify that the collateral can be transferred into the adapter and that the lending asset can be returned to the market.

## Phase 4 — Complete the provider-wide core blocker before enabling real borrowing

`LendingMarketV2` still requires a coordinated interest-accrual review. The current source has the cross-decimal normalization fix, but live release should not be declared complete until elapsed-time interest accrual, repayment accounting, liquidation debt, frontend estimates, and tests agree. This is provider-neutral work and should be completed before exposing real borrowing on either network.

The same review should confirm that DEX liquidation is safe for the intended collateral, that fee-on-transfer or unusual token behavior is handled, that route liquidity is sufficient, and that liquidation remains available during the relevant market and oracle states.

## Phase 5 — Apply the database migration with a backup and rollback plan

The branch adds a nullable indexed `providerId` field to the backend `Market` model and adds the migration at `backend/prisma/migrations/20260827_add_market_provider_id/migration.sql`.

Before applying it to a real database:

1. Confirm the PR is merged and the backend release artifact contains the matching Prisma schema and generated client.
2. Take a database backup and record the backup identifier.
3. Confirm the migration is additive and that the target database is the intended environment.
4. Run `cd backend && npx prisma migrate deploy` using the approved production connection.
5. Verify the `markets.providerId` column and index exist, then start the backend with the matching code.
6. Confirm existing markets remain discoverable with a null provider ID and newly indexed provider markets persist the correct provider ID.

Do not run `prisma migrate reset`, do not delete existing rows, and do not apply the migration before the backup and environment confirmation.

## Phase 6 — Redeploy contracts to a new isolated deployment

The old Base Sepolia contracts cannot be upgraded by merging this PR. For each target network, deploy a new compatible set consisting of `AdapterRegistry`, `MarketDeployer`, `MarketFactoryV2`, the market implementation used by the deployer, generic adapters, provider adapters, configurators, compliance adapters, and the liquidation adapter.

Before a live deployment, populate the deployment environment with the reviewed manifest. The deployment script must fail before sending transactions if Robinhood lending asset, router, sequencer, or provider-token values are missing. Use a fresh deployment namespace and retain the generated deployment JSON. Never point the frontend at a partially configured factory.

After deployment, perform the following owner/governance transactions in order, with transaction receipts recorded:

1. Register and verify the adapter addresses in `AdapterRegistry`.
2. Authorize the B20 and Robinhood configurators on the shared oracle and B20 compliance adapters where applicable.
3. Register the provider configurators on `MarketFactoryV2`.
4. Reserve each approved collateral token with `setProviderAsset(providerId, token, true)`.
5. Add only the approved lending asset with `addLendingAsset`.
6. Configure the DEX router and transfer adapter ownership to the approved protocol owner.
7. Create a provider market only after all adapter, oracle, compliance, router, feed, sequencer, and pool parameters pass the read-only checklist.
8. Configure the selected pool fee for the created market and record the resulting configuration.

Every transaction in this section is approval-gated. The deployment script should be run only after explicit confirmation for the named network and manifest.

## Phase 7 — Update application configuration and migrate traffic

Update the frontend contract manifest with the new factory and adapter addresses for the exact chain ID. Set the backend chain configuration and provider catalog to the same deployment JSON. Do not reuse old Base Sepolia addresses for Base mainnet or Robinhood Chain. Keep testnet mock manifests separate from production provider catalogs.

Deploy the backend first, verify market discovery and provider ID persistence, then deploy the frontend. Confirm that the creation page blocks zero-address configuration, wrong-chain canonical assets, unapproved Robinhood manual entries, missing sequencer configuration, and missing provider feeds.

## Phase 8 — Run post-deployment read-only and canary checks

Before allowing third-party users, run read-only checks for factory owner, configurator mappings, provider asset reservations, lending-asset allowlist, adapter registry verification, market provider ID, oracle feed configuration, sequencer address, token pause status, token/feed decimals, and liquidation router configuration.

Then use a controlled canary market and approved test wallets. Supply a small amount of liquidity, create one market, allowlist one test wallet through the approved compliance process, escrow a small collateral amount, borrow a small selected principal, verify decimal-normalized limits, repay, and exercise liquidation only in a controlled environment. Record all receipts and expected balances. Do not treat a successful borrow alone as proof of safe liquidation.

## Phase 9 — Operational monitoring and rollback

Monitor feed freshness, sequencer status, token `oraclePaused()`, provider catalog changes, pool liquidity, quote output, liquidation failures, compliance changes, and market-provider metadata. The first response to an oracle, token, route, or compliance anomaly should be to pause originations or disable the affected market, not to loosen safety checks.

Rollback means stopping new originations, preserving repayment and liquidation paths where safe, disabling the affected provider market or frontend route, and retaining evidence. It does not mean deleting market rows or reversing an irreversible on-chain deployment.

## Explicit approval checkpoints

| Checkpoint | Safe to prepare now? | User approval required to execute? |
| --- | --- | --- |
| Read-only RPC, token, feed, pool, router, and quote checks | Yes | No |
| Pull request creation and source commit | Yes | No, unless you want to review before opening it |
| Prisma migration on production/staging DB | Prepare only | Yes |
| Contract deployment/redeployment | Prepare only | Yes |
| Owner/governance configuration transactions | Prepare only | Yes |
| Market creation and liquidity supply | Prepare only | Yes |
| Borrowing, repayment, liquidation canary | Prepare only | Yes |
| Frontend/backend production rollout | Prepare only | Yes, as a release decision |

## References

[1]: https://docs.robinhood.com/chain/contracts/ "Robinhood Chain Token Contracts"

[2]: https://docs.robinhood.com/chain/connecting/ "Connecting to Robinhood Chain"

[3]: https://docs.robinhood.com/chain/oracles-and-price-feeds/ "Robinhood Chain Oracles and Price Feeds"

[4]: https://docs.chain.link/data-feeds/tokenized-equity-feeds/robinhood "Chainlink Robinhood Tokenized Equities"

[5]: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments "Uniswap v3 Robinhood Chain Deployments"
