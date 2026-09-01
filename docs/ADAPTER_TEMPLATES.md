# OpenAsset Adapter Template Catalog

This catalog turns the production adapter implementations into starter templates. Each template is a working Solidity contract, has a focused test or integration path, and links to the relevant specification and verification requirements. Templates are starting points, not safety endorsements.

| Category | Working template | Test evidence | Primary assumptions |
|---|---|---|---|
| ERC-20 pricing | [`ChainlinkAdapter`](../contracts/src/adapters/oracle/ChainlinkAdapter.sol) | `test/unit/ChainlinkAdapter.test.ts` | Feed decimals, freshness, positive answer, and optional L2 sequencer feed |
| ERC-20 liquidation | [`DEXSwapLiquidationAdapter`](../contracts/src/adapters/liquidation/DEXSwapLiquidationAdapter.sol) | `test/unit/DEXSwapLiquidationAdapter.test.ts` | Router quotes, slippage bounds, and asset-adapter handoff |
| NFT pricing | [`NFTOracle`](../contracts/src/NFTOracle.sol) | `test/unit/LendingMarketV2.test.ts` and NFT oracle fuzz handlers | Collection/token valuation and stale-price policy |
| NFT liquidation | [`NFTAuctionLiquidationAdapter`](../contracts/src/adapters/liquidation/NFTAuctionLiquidationAdapter.sol) | `test/unit/LendingMarketV2.test.ts` and liquidation handlers | Auction lifecycle and asynchronous settlement assumptions |
| Compliance | [`ERC3643ComplianceAdapter`](../contracts/src/adapters/rwa/ERC3643ComplianceAdapter.sol) | `test/unit/B20Adapters.test.ts` | Identity registry must fail closed on unavailable or invalid responses |
| RWA pricing | [`NAVOracleAdapter`](../contracts/src/adapters/rwa/NAVOracleAdapter.sol) | `test/unit/ChainlinkEquityFeedAdapter.test.ts` and integration tests | Issuer NAV freshness and optional proof-of-reserve signal |
| RWA compliance | [`ManagedAllowlistComplianceAdapter`](../contracts/src/adapters/rwa/ManagedAllowlistComplianceAdapter.sol) | `test/unit/B20Adapters.test.ts` | Explicit operator-managed eligibility and auditability |
| Other high-demand: tokenized equity | [`ChainlinkEquityFeedAdapter`](../contracts/src/adapters/rwa/ChainlinkEquityFeedAdapter.sol) | `test/unit/ChainlinkEquityFeedAdapter.test.ts` | Trading session, oracle freshness, and issuer/token decimals |
| Other high-demand: policy-controlled asset | [`B20AssetAdapter`](../contracts/src/adapters/asset/B20AssetAdapter.sol) | `test/unit/B20Adapters.test.ts` | Policy registry authorization and issuer transfer restrictions |

## Local use

```bash
cd contracts
npm install
npm run compile
npx hardhat test test/unit/ChainlinkAdapter.test.ts test/unit/DEXSwapLiquidationAdapter.test.ts test/unit/B20Adapters.test.ts test/unit/ChainlinkEquityFeedAdapter.test.ts
npx hardhat test test/adapter-environment/AdapterEnvironment.test.ts
```

A new template must follow the [Adapter Specification](./ADAPTER_SPECIFICATION.md), include a focused test file, and add its assumptions and failure modes to this catalog. The [Adapter Testing Environment](./ADAPTER_TESTING.md) supplies deterministic mocks for dependency failures, stale feeds, compliance denial, liquidation failure, gas checks, and custom adapters.

## Template acceptance checklist

Before adding a template to this catalog, confirm that it compiles with Solidity `^0.8.20`, implements the exact interface, uses factory-scoped multi-tenancy or the position clone pattern, rejects unconfigured callers, documents dependencies and economic assumptions, and passes the applicable happy-path, isolation, adversarial, failure, accounting, and gas tests. Verification status is separate from template inclusion.
