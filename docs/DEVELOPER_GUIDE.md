# OpenAsset Developer Guide

OpenAsset is a permissionless lending protocol for isolated markets. Developers can build markets around ERC-20s, NFTs, tokenized real-world assets, and other assets by selecting asset, oracle, compliance, liquidation, and position adapters. The core engine retains loan state, accounting, circuit breakers, reentrancy protection, and defensive output checks; adapters provide bounded integrations at the documented trust boundary.

## What can I build?

| Goal | Starting point | Output |
|---|---|---|
| Launch an isolated lending market | [Market Creator Guide](./MARKET_CREATOR_GUIDE.md) and `contracts/src/MarketFactoryV2.sol` | Market with chosen assets, oracle, risk parameters, and adapter set |
| Support a new collateral type | [Adapter Specification](./ADAPTER_SPECIFICATION.md) and [template catalog](./ADAPTER_TEMPLATES.md) | Asset adapter plus tests for escrow, release, and transferability |
| Add a price source | SDK interfaces and oracle references | Multi-tenant oracle adapter with normalized USD price and trust signal |
| Add eligibility rules | Compliance interfaces and RWA references | Fail-closed compliance adapter |
| Add a liquidation route | Liquidation interfaces and existing swap/auction references | Synchronous or asynchronous liquidation adapter with reconciliation |
| Represent loan ownership | Position adapter references | EIP-1167 clone-compatible position adapter |
| Integrate protocol data | Registry and contract interfaces | Registry/indexer/market-creation integration using on-chain events and views |

## Documentation map

1. **Understand the protocol:** [Protocol overview](../README.md), [architecture](../web/content/protocol/overview.mdx), [loan lifecycle](../web/content/protocol/loan-lifecycle.mdx), and [security baseline](./SECURITY_BASELINE.md).
2. **Create a market:** [Market Creator Guide](./MARKET_CREATOR_GUIDE.md), [create-market guide](../web/content/guides/create-market.mdx), and deployment manifests.
3. **Build adapters:** [Adapter Specification](./ADAPTER_SPECIFICATION.md), [Adapter Developer Guide](./ADAPTER_DEVELOPER.md), [Adapter Security Model](./ADAPTER_SECURITY_MODEL.md), and [template catalog](./ADAPTER_TEMPLATES.md).
4. **Install the SDK:** [SDK README](../sdk/README.md) and `npm install @openasset/adapter-sdk` once published.
5. **Test locally:** [Adapter Testing Environment](./ADAPTER_TESTING.md), Hardhat tests under `contracts/test/`, and gas/coverage commands.
6. **Register and discover:** [Adapter Registry](../web/content/protocol/adapter-registry.mdx) and `contracts/src/AdapterRegistry.sol`.
7. **Verify and submit:** [Verification Policy](./VERIFICATION_POLICY.md) and [Submission Workflow](./ADAPTER_SUBMISSION_WORKFLOW.md).
8. **Deploy and integrate:** [operations documentation](./OPERATIONS.md), deployment scripts under `contracts/scripts/`, ABI artifacts, and the integration checklist below.

## Developer path

Read the specification and security model, install dependencies, create a scaffold or copy a reference adapter, implement the smallest complete change, run unit/integration/adversarial/gas tests, run the automated submission checker, record the source commit and dependencies, register metadata, and submit the evidence package for review. Never treat the frontend, registry registration, or a Verified badge as an on-chain security boundary.

## Integration checklist

Before integrating an adapter or market, confirm the chain ID and checksummed addresses, interface revision, factory and owner permissions, configured market addresses, oracle freshness and decimals, compliance failure behavior, liquidation handoff and accounting, event subscriptions, registry status, and emergency runbook. Read state from the deployed contract rather than relying on cached frontend assumptions. Index `AdapterRegistered`, `AdapterMetadataUpdated`, review-status, verification, deprecation, configuration, market, loan, oracle, and circuit-breaker events.

## Local commands

```bash
cd contracts
npm install
npm run compile
npx hardhat test
REPORT_GAS=true npx hardhat test test/adapter-environment/AdapterEnvironment.test.ts
./scripts/check-adapter-submission.sh oracle src/adapters/oracle/ChainlinkAdapter.sol

cd ../sdk
npm test
npm run pack:check
```

## Principles for contributors

Keep changes small and testable, document assumptions where the code makes them, prefer fail-closed behavior, avoid unbounded work in transaction paths, preserve market isolation, and include a migration or rollback plan for any deployment or dependency change. If the same developer question appears twice, capture the answer in this guide or open a documentation issue using the [feedback process](./DEVELOPER_FEEDBACK.md).
