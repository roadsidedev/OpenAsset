# OpenAsset Contracts — Security Remediation (run-1)

This document records the contract remediations applied on `security/remediation-run-1`
for the confirmed findings in the run-1 audit package.

## Fixes implemented

| ID | Finding | Remediation |
|----|---------|-------------|
| R-07 | `MarketDeployer.deploy` unrestricted | `deploy` is `onlyFactory`. Deployer constructs its own `LendingMarketV2` template; `setFactory` wires `MarketFactoryV2` once after factory construction. |
| R-08 | Direct `clone` + `initialize` bypass | `LendingMarketV2` stores immutable `deployer`; `initialize` requires `msg.sender == deployer`. Fail-closed param checks remain in `MarketDeployer.deploy`. |
| R-09 | `isSelectable` ignores verified / REJECTED | `isSelectable` requires `verified && !deprecated && reviewStatus != REJECTED`. `markRejected` also sets `deprecated = true`. Factory adds adapter-type checks. |
| R-10 | Uniswap V3 TWAP stubbed | On-chain TWAP via `UniswapV3TwapLibrary.consult` / `getQuoteAtTick`. Factory best-effort binds pools through `getPoolForAsset` → `registerPoolForMarket`. Keeper `updatePrice` remains fallback when observations are unavailable. |
| R-11 | Issuer redemption ID cross-market | `loanRedemptionId` is now `mapping(address market => mapping(uint256 loanId => uint256))`. |
| R-12 | NFT `buy` Seaport approval revoke | `openAuctionsByCollection` counter; `setApprovalForAll(false)` only when no OPEN auctions remain for that collection. |
| R-13 | DEX underwater unliquidatable | DEX adapter accepts `amountOut < debtOwed` and settles shortfall; `getLiquidationMinOutput` no longer floors at full `debtOwed`. |
| R-14 | Chainlink historical ignores staleness | `getHistoricalPrice` walks rounds / applies staleness + sequencer checks; does not return unchecked latest as historical. Caps `maxStaleness` on `registerFeed`. |
| R-20 | Permissionless liquidate / async CURE | **Accepted risk (option A):** `liquidate` / `settleLiquidation` remain permissionless (Aave-style). Documented below. |

## R-20 — Permissionless liquidation (accepted risk)

**Decision:** Keep Aave-style permissionless liquidators.

**Rationale:** Permissionless liquidation is a core solvency mechanism. Restricting
`liquidate` to a keeper allowlist would introduce liveness risk (keeper downtime =
bad debt accumulation) and centralization. The async CURE window already charges a
penalty to discourage grief, and markets can pause via the circuit breaker / owner.

**Monitoring recommendations:**
- Alert on `LiquidationCureStarted` volume / rate per market
- Alert when loans remain in `LIQUIDATION_CURE` near cure expiry without repayment
- Alert on repeated CURE entries for the same loanId (grief pattern)
- Dashboard: underwater loans that fail DEX liquidation vs succeed after shortfall fix
- Page on-call if liquidation backlog (OPEN auctions / unsettled redemptions) exceeds SLO

**Future option:** If mainnet abuse is observed, gate async adapters behind a
liquidator allowlist without changing sync DEX/NFT paths.

## Deployment notes

1. Deploy `MarketDeployer` (no constructor args — embeds template).
2. Deploy `MarketFactoryV2` with deployer address.
3. Call `MarketDeployer.setFactory(factory)`.
4. For Uniswap TWAP markets: `registerPoolForAsset` (or `registerPoolForMarket`) before/at create.
5. Adapter governance must `markVerified` before adapters are selectable for new markets.

## Tests

Forge suite: `test/security_remediation/` (anti-PoCs for R-07, R-08, R-09, R-11).
