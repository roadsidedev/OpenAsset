# Developer Quick Start: Zero to Working Adapter

This path is designed to take a developer from **read → install → copy template → modify → test → submit**. It uses the local Hardhat chain and does not require a wallet, testnet funds, or external RPC access.

## 1. Read

Read these in order:

1. [Adapter Specification](./ADAPTER_SPECIFICATION.md) for the exact interface and behavior.
2. [Adapter Security Model](./ADAPTER_SECURITY_MODEL.md) for permissions, verification, versioning, upgrades, revocation, and emergencies.
3. [Adapter Testing Environment](./ADAPTER_TESTING.md) for the local mocks and required evidence.
4. [Adapter Template Catalog](./ADAPTER_TEMPLATES.md) to choose the closest first-party implementation.

Choose one adapter category before writing code. Asset, oracle, compliance, and liquidation adapters are shared multi-tenant instances; position adapters are EIP-1167 clones.

## 2. Install

```bash
git clone https://github.com/roadsidedev/OpenAsset.git
cd OpenAsset
cd contracts
npm install
npm run compile
cd ../sdk
npm install
npm test
```

The SDK can also be consumed from another project:

```bash
npm install @openasset/adapter-sdk
npx create-openasset-adapter --type oracle --name MyOracleAdapter
```

For repository-local development, use `npm install file:../OpenAsset/sdk` from the adapter project. The package requires Solidity `^0.8.20`.

## 3. Copy a template

Use the scaffold for a minimal interface-safe starting point:

```bash
cd /path/to/your/adapter-project
npx create-openasset-adapter --type oracle --name MyOracleAdapter
```

For teaching code with realistic dependency handling, copy the closest first-party reference from `contracts/src/adapters/`. For example, use `ChainlinkAdapter.sol` for a feed-backed ERC-20 price, `DEXSwapLiquidationAdapter.sol` for a router-backed liquidation, or `ManagedAllowlistComplianceAdapter.sol` for managed eligibility.

The scaffold is not production-ready. Replace placeholders, add per-market configuration, document dependency and economic assumptions, and retain the factory/market authorization pattern.

## 4. Modify

Implement every interface function and record:

- The semantic version and interface revision.
- The factory and owner/governance roles.
- Per-market configuration and unconfigured behavior.
- External dependency addresses, decimals, freshness, and failure semantics.
- Asset movement and liquidation balance assumptions.
- Synchronous/asynchronous behavior and cure-window rules.
- Emergency disable, revocation, and migration behavior.

Do not use `tx.origin`, direct uncontrolled custody, proxy upgrades behind a deployed adapter address, or permissionless updates to security-critical dependencies.

## 5. Test

Copy `contracts/test/adapter-environment/AdapterEnvironment.test.ts` and replace the example adapter with your custom adapter. Add the applicable unit and adversarial cases.

```bash
cd contracts
npm run compile
npx hardhat test test/adapter-environment/AdapterEnvironment.test.ts
npx hardhat test test/unit/<your-adapter>.test.ts
REPORT_GAS=true npx hardhat test test/adapter-environment/AdapterEnvironment.test.ts
npx hardhat coverage
./scripts/check-adapter-submission.sh oracle path/to/MyOracleAdapter.sol
```

Your evidence must include happy path, two-market isolation, unauthorized callers, invalid inputs, unconfigured market, dependency failure, accounting/reconciliation, reentrancy/CEI, gas, and version/deployment reproducibility. Compliance and oracle adapters need fail-closed and stale/invalid-data tests; liquidation adapters need synchronous/asynchronous and surplus tests.

## 6. Submit

Prepare a package containing the deployed address and chain, adapter type, name and semantic version, source commit, interface revision, configuration instructions, supported assets, documentation and repository URIs, dependency addresses and versions, test commands/results, gas report, known limitations, economic assumptions, and emergency contacts/runbook.

Register with metadata:

```text
registerAdapterWithMetadata(
  adapter,
  adapterType,
  name,
  version,
  category,
  supportedAssets,
  documentationURI,
  repositoryURI
)
```

Registration starts as **UNREVIEWED**. The automated checker is a gate, not a security review. Governance marks **IN_REVIEW**, then **APPROVED** with a review reference or **REJECTED** with a durable reason reference. A Verified mark is not a safety guarantee. A logic change requires a new address, source commit, version, registry entry, and review.

## Definition of done

You are ready to submit when another developer can clone the source, install dependencies, run the documented commands, understand every external dependency and failure mode, reproduce the test results from the recorded commit, and explain how the adapter can be deprecated or replaced without silently changing existing markets.
