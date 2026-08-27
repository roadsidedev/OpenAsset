# OpenAsset Provider-Bundle Implementation Report

**Repository:** [`roadsidedev/OpenAsset`](https://github.com/roadsidedev/OpenAsset)
**Branch:** `audit/base-stocks`
**Baseline commit:** `2928a66f98ee8428ddd60c69e35dee2575baf7d5`
**Review date:** 27 August 2026
**Implementation status:** Source changes applied locally and validated; not committed, deployed, or transacted on-chain.
**Scope:** Base B20 tokenized stocks and Robinhood Stock Tokens, with a provider-neutral core for future Ondo, xStocks, Binance bStocks, and other issuers.

## Executive conclusion

The OpenAsset source tree now contains an extensible provider-bundle architecture for independent B20 and Robinhood Stock Token integrations. `LendingMarketV2` remains issuer-neutral: it operates on adapter interfaces and does not contain B20- or Robinhood-specific business logic. Provider-specific setup is delegated to registered configurators and runs atomically before liquidity initialization and market publication.

The implementation supports the complete **local/mock borrowing path** for the two providers: provider asset selection, adapter wiring, oracle and compliance configuration, liquidity initialization, collateral escrow, selected-principal borrowing, oracle trust checks, and Robinhood token-oracle pause rejection. The Robinhood flow is tested with a local 18-decimal ERC-20 mock and a mock Chainlink feed. This is not a live issuer or mainnet end-to-end certification.

No contracts were deployed, no database migration was applied, and no on-chain transaction was transmitted during this work. Existing Base Sepolia deployments therefore remain legacy bytecode and are not repaired by these source changes. A compatible redeployment is required before any of the new protections or provider bundles are live.

## Architecture implemented

| Layer | Implementation | Extensibility consequence |
| --- | --- | --- |
| Lending core | `LendingMarketV2` remains provider-neutral and consumes asset, oracle, compliance, liquidation, and position interfaces. | New issuers do not require edits to the lending state machine. |
| Provider identity | `ProviderIds.sol` defines stable identifiers for `OPENASSET_PROVIDER_B20` and `OPENASSET_PROVIDER_ROBINHOOD`. | Future providers can add independent IDs without changing core lending logic. |
| Atomic setup | `IProviderConfigurator` defines provider-specific market initialization. `MarketFactoryV2.createProviderMarket` executes generic adapter setup, provider setup, liquidity transfer, initialization, and publication as one transaction. | Provider bundles can bind issuer-specific token/oracle/compliance controls behind one factory entry point. |
| Factory governance | `providerConfigurators`, `isProviderAsset`, and `canonicalProviderForAsset` reserve approved collateral assets for their provider bundle. A reserved asset cannot use legacy `createMarket`, and a provider market cannot use an unapproved asset. | Governance must explicitly onboard each canonical token; UI selection alone is not the security boundary. |
| B20 bundle | `B20ProviderConfigurator`, `B20AssetAdapter`, `B20PolicyComplianceAdapter`, and shared `ChainlinkEquityFeedAdapter`. | Official `uint64` B20 policy IDs, sender/receiver/executor checks, feed registration, and sequencer safeguards are isolated from the core. |
| Robinhood bundle | `RobinhoodProviderConfigurator`, shared equity oracle with token `oraclePaused()` checking, `ManagedAllowlistComplianceAdapter`, and standard ERC-20 asset adapter. | Robinhood-specific pause semantics and off-chain-administered eligibility are isolated from B20 policy semantics. |
| Frontend/backend manifests | Provider IDs, chain IDs, canonical assets, feeds, decimals, legal labels, and allowlist requirements are represented in provider-aware catalogs. | Additional providers can be added as manifests and configurators rather than hardcoded core branches. |

The factory-level reservation is deliberately stronger than a frontend-only restriction. It prevents a governance-registered B20 or Robinhood collateral token from being created through the provider-neutral legacy path. Unknown assets remain generic until governance onboards them, which is intentional: a future provider must not be treated as approved merely because its token address resembles a known product.

## B20 implementation status

The B20 path uses the official policy-registry ABI shape with `uint64` policy identifiers and checks sender, receiver, and executor policy authorization before transfer operations. B20 policy configuration is authorized through the registered provider configurator rather than exposing arbitrary market binding to unrelated callers.

The Chainlink equity adapter treats missing, stale, malformed, negative, or untrusted oracle data as unusable. L2 sequencer status follows Chainlink’s documented polarity, where status `0` represents operational and status `1` represents down; stale sequencer data and the configured recovery grace period fail closed [2]. The B20 provider configurator validates feed and optional sequencer code before registering the market-specific feed and policy token.

The frontend catalog now exposes canonical B20 assets only on Base mainnet chain ID `8453`. Base Sepolia chain ID `84532` no longer inherits production B20 metadata. Its test flow must use explicitly deployed mock B20 assets and a clearly separate test manifest. A canonical B20 address entered on the wrong chain is rejected by the creation UI, while the factory reservation prevents a registered canonical asset from bypassing its provider bundle.

## Robinhood Stock Token implementation status

The Robinhood pilot currently contains one verified catalog pair: the AAPL Stock Token on Robinhood Chain chain ID `4663` and its corresponding Chainlink feed proxy. The frontend labels the asset as a Robinhood Stock Token and displays the tokenized-debt-security distinction rather than presenting it as direct Apple share custody. Additional assets must not be added from ticker matching alone; each token, feed, decimals value, and provider status requires independent verification against the issuer and oracle source of truth.

The Robinhood provider configurator decodes `(feed, maxStaleness, l2Sequencer)`, requires executable feed and sequencer contracts, and registers the feed with token-level `oraclePaused()` checking. A paused token oracle makes the price untrusted and blocks borrowing. The design does not multiply the Chainlink tokenized-equity price by `uiMultiplier()`: the provider-specific feed is treated as the risk price, while display/share-equivalent mechanics remain presentation metadata.

Robinhood eligibility is implemented through `ManagedAllowlistComplianceAdapter`. This is an owner-managed technical enforcement point, not an identity, KYC, KYB, sanctions, or geographic screening provider. External legal and compliance controls must approve a user before the administrator marks that user eligible for a particular market. The UI does not claim that a wallet is legally eligible merely because it can connect.

The Robinhood provider is now **fail-closed on sequencer configuration**. A zero sequencer address is rejected by the configurator and by the frontend deployment/creation path. No verified official Robinhood Chain sequencer uptime-feed address was available in the reviewed material; deployment is therefore blocked until an official provider-supplied or otherwise independently verified chain-health contract is selected, or governance explicitly documents and approves a different risk-control design.

## Decimal normalization and lending flow

A material cross-decimal bug was fixed in `LendingMarketV2`. The market now stores immutable collateral and lending-token decimals and normalizes collateral value into lending-token units using `Math.mulDiv`. This corrects origination and health-factor calculations for combinations such as 8-decimal B20 collateral, 18-decimal Robinhood collateral, and 6-decimal USDC. The same normalized value is used by the DEX liquidation minimum-output helper.

The tested local flow is:

| Step | B20 | Robinhood |
| --- | --- | --- |
| Asset standard | B20 ERC-20-compatible token/precompile behavior | Standard 18-decimal ERC-20 mock in tests |
| Oracle | Chainlink total-return feed with B20 policy/sequencer controls | Chainlink feed plus fail-closed `oraclePaused()` token check and required sequencer configuration |
| Compliance | B20 policy registry plus market configuration | Market-scoped managed allowlist; external KYC/KYB/legal process remains required |
| Borrowing | Collateral escrow, selected principal, USDC-denominated debt | Collateral escrow, selected principal, 6-decimal USDC-denominated debt |
| Liquidation | Single-hop Uniswap V3 exact-input path in the existing DEX adapter | Same generic DEX path in local integration; issuer redemption is not integrated |

The selected-principal path rejects a requested amount above the normalized oracle-valued maximum. Collateral is transferred into the market before loan creation, and the tests verify the market balance after escrow.

## Safety and bypass remediation

The factory now requires a governance-approved `(providerId, collateralAsset)` reservation for every nonzero provider bundle. It rejects mismatched configurators, missing configurators, unapproved provider collateral, invalid provider setup, and provider configuration failures before publication. Because all state changes occur inside the non-reentrant market-creation call, a configurator revert also rolls back the deployment and liquidity flow.

The legacy `createMarket` entry point remains available for provider-neutral assets and future non-stock markets. It rejects assets that governance has explicitly reserved for a provider. This keeps backward compatibility without allowing known onboarded provider assets to silently use generic adapters. New provider assets must be reserved before users can create their provider market.

The frontend additionally blocks manual generic market creation on Robinhood Chain and rejects known provider assets entered on the wrong network. Canonical B20 assets are restricted to Base mainnet in the provider catalog and B20 helper functions. The backend and indexer persist `providerId` for discovered markets, while the new Prisma migration remains unapplied pending explicit database approval.

## Validation evidence

| Validation | Result |
| --- | --- |
| Fresh viaIR Solidity compile using Solidity 0.8.20 and optimizer runs 20 | Passed; `contracts=111`, warnings only |
| Non-archived Solidity unit and integration suites | Passed; **91 tests** using `npx hardhat test --no-compile test/unit/*.ts test/integration/*.ts` |
| B20 policy and factory regressions | Passed, including official selector behavior, executor policy checks, atomic setup, invalid sequencer rollback, provider reservation, and legacy-path bypass rejection |
| Robinhood provider bundle tests | Passed, including atomic configuration, provider identity, 18-decimal escrow and selected-principal borrowing, paused-token rejection, invalid-feed rollback, unapproved collateral rejection, and non-owner registry rejection |
| Cross-decimal lending regression | Passed for 8-decimal collateral into 6-decimal USDC |
| Frontend TypeScript check | Passed; `cd web && npx tsc --noEmit` |
| Frontend production build | Passed; `cd web && npm run build` |
| Backend Prisma generation and production build | Passed; `cd backend && npx prisma generate && npm run build` |
| Working-tree whitespace check | Passed; `git diff --check` |

The default unscoped Hardhat command remains blocked by a pre-existing archived v1 test import of a missing legacy `typechain-types` module. The explicit non-archived command above is the authoritative validation command for this change set. The Solidity project-level TypeScript check remains affected by a pre-existing missing `minimatch` declaration and is separate from the successful compile and Hardhat test results.

## Production release gates

| Gate | Status | Required action |
| --- | --- | --- |
| Compatible redeployment | **Blocked** | Redeploy the updated factory, market deployer/implementation, adapters, configurators, and markets. Existing Base Sepolia bytecode is not upgraded by source changes. |
| Robinhood lending asset | **Blocked** | Verify and configure the official Robinhood Chain lending stablecoin address and decimals. |
| Robinhood chain health | **Blocked** | Supply and independently verify an official sequencer/outage health contract, or document and approve an alternative fail-closed risk control. |
| Robinhood liquidation route | **Blocked** | Verify router, pool fee, liquidity, token transfer restrictions, and liquidation legality on Robinhood Chain; direct issuer redemption is not implemented. |
| B20 mainnet route | **Blocked until deployment review** | Verify router, fee tier, liquidity, policy registry, feed addresses, and adapter bytecode on Base mainnet. |
| Interest accrual | **Material blocker** | Replace the current fixed principal/APR calculation with elapsed-time accrual and update repayment, liquidation, estimates, and tests together. |
| Legal/compliance | **Blocked** | Obtain review for tokenized debt/security classification, jurisdictional eligibility, sanctions, KYC/KYB, issuer restrictions, Regulation S/non-US requirements, and administrator controls. |
| Database migration | **Pending approval** | Apply `npx prisma migrate deploy` only after explicit approval and a backup/rollback plan. |
| Provider catalog governance | **Pending** | Move canonical asset/feed updates behind reviewed manifests or a signed/governed registry before expanding beyond the AAPL pilot. |
| Production audit/fork testing | **Blocked** | Run pinned fork/read-only verification and a full security review of the new factory registry, provider configurators, cross-decimal math, DEX route, and compliance boundaries. |

The current DEX implementation is deliberately narrow: it uses a single-hop Uniswap V3 exact-input route with a configured fee and oracle-derived minimum output. It does not prove that a live provider token has adequate liquidity or that liquidation is legally permitted. A production deployment must not enable a provider merely because local mocks pass.

## Files changed by this implementation

The principal new or modified areas are `contracts/src/MarketFactoryV2.sol`, `contracts/src/LendingMarketV2.sol`, `contracts/src/ProviderIds.sol`, `contracts/src/interfaces/IProviderConfigurator.sol`, `contracts/src/providers/B20ProviderConfigurator.sol`, `contracts/src/providers/RobinhoodProviderConfigurator.sol`, `contracts/src/adapters/rwa/ManagedAllowlistComplianceAdapter.sol`, `contracts/src/adapters/rwa/ChainlinkEquityFeedAdapter.sol`, the B20 policy and asset adapters, the DEX liquidation adapter, and the provider-focused Solidity tests.

The application changes include `web/src/lib/providerBundles.ts`, chain-aware `web/src/lib/b20.ts`, `web/src/lib/supportedAssets.ts`, the market-creation and market-discovery flows, `web/src/components/MarketCard.tsx`, the frontend contract manifest and chain configuration, backend provider catalog/configuration/controller/indexer changes, and the unapplied Prisma migration adding nullable indexed `providerId` to markets.

## Basis, time, assumptions, sources, and compliance disclosure

**Basis:** The conclusions are based on the OpenAsset source tree, local compile/test/build outputs, the provider-bundle implementation, and the previously verified B20 and Robinhood integration research. Valuation uses the configured Chainlink feed as the risk-price source; no `uiMultiplier()` adjustment is applied to the Robinhood risk price. **Time:** Source review and validation were completed on 27 August 2026; no live deployment or on-chain transaction was performed. **Assumptions:** Provider IDs are the keccak256 hashes of the documented names, B20 canonical assets are Base-mainnet-only, Robinhood markets require a configured sequencer health contract, DEX liquidation uses a single configured Uniswap V3 fee tier, and allowlist eligibility is administered outside the protocol after legal/compliance review. **Sources and confidence:** Confidence is high for the stated local source and test results, moderate for the architecture’s production suitability pending audit, and insufficient for live Robinhood deployment until chain-specific stablecoin, sequencer, router, liquidity, and compliance values are verified. **Compliance:** This engineering report does not establish that any token may legally be offered as collateral or that any user is eligible to borrow. Legal, regulatory, issuer, and sanctions review remains mandatory. This is research and engineering analysis only, not personalized financial advice.

## References

[1]: https://www.base.org/stocks "Base Stocks"

[2]: https://docs.chain.link/data-feeds/l2-sequencer-feeds "Chainlink L2 Sequencer Uptime Feeds"

[3]: https://docs.chain.link/data-feeds/price-feeds/addresses "Chainlink Price Feed Contract Addresses"

[4]: https://github.com/roadsidedev/OpenAsset "OpenAsset source repository"
