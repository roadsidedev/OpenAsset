# @openasset/adapter-sdk

The OpenAsset Adapter SDK is the installable developer package for building, testing, and submitting adapters. It packages the canonical Solidity interfaces, reusable base contract and primitives, a deterministic example oracle, a scaffold generator, and test guidance.

## Install

From npm, once published:

```bash
npm install @openasset/adapter-sdk
```

For local development from this repository:

```bash
npm install file:../OpenAsset/sdk
```

The package requires Solidity `^0.8.20`. If an adapter uses OpenZeppelin, install `@openzeppelin/contracts` in the adapter project; the SDK declares it as a peer dependency.

## Create an adapter from a template

```bash
npx create-openasset-adapter --type oracle --name MyPythAdapter
cd MyPythAdapter
```

Supported types are `asset`, `oracle`, `compliance`, `liquidation`, and `position`. The generated contract is an intentionally small starting point. Before deployment, implement every interface function, add per-market configuration, restrict factory and market calls, document external dependencies, and add the required test matrix. The generated project is not a production-ready adapter.

## SDK contents

| Path | Purpose |
|---|---|
| `contracts/interfaces/` | Canonical `IAssetAdapter`, `IOracleAdapter`, `IComplianceAdapter`, `ILiquidationAdapter`, `IPositionAdapter`, and `IPositionAdapterInit` interfaces |
| `contracts/base/BaseAdapter.sol` | Factory and configured-market guards for multi-tenant adapters |
| `contracts/errors/AdapterErrors.sol` | Shared custom errors for invalid inputs, authorization, configuration, and dependency failures |
| `contracts/types/AdapterTypes.sol` | Shared `PriceQuote` and `LiquidationResult` structs |
| `contracts/helpers/AdapterMath.sol` | WAD normalization and positive-value/timestamp validation helpers |
| `contracts/examples/ExampleOracleAdapter.sol` | Deterministic local example implementing the oracle interface |
| `test-utils/` | Dependency-free package smoke test and integration-test guidance |
| `bin/create-openasset-adapter.js` | Project scaffold CLI exposed as `create-openasset-adapter` |

## Local development

The repository's full Solidity test environment lives in `contracts/`:

```bash
cd contracts
npm install
npm run compile
npx hardhat test test/unit/ExampleOracleAdapter.test.ts
```

To verify the SDK package itself:

```bash
cd sdk
npm test
npm run pack:check
```

The package smoke test checks that all public SDK components are present. Adapter projects should add a Hardhat or Foundry test suite and run the matrix in [`../docs/ADAPTER_TESTING.md`](../docs/ADAPTER_TESTING.md).

## Implementation rules

All adapters except position adapters are multi-tenant. Store configuration by market address and resolve it from `msg.sender`. Position adapters are EIP-1167 clones and must use `IPositionAdapterInit` with one-time initialization. Runtime functions must fail closed when unconfigured or when a dependency is unavailable. Adapter contracts are non-upgradeable; a logic change requires a new address, version, deployment, and verification review.

Read the [normative Adapter Specification](../docs/ADAPTER_SPECIFICATION.md) before implementation. Use the [Adapter Developer Guide](../docs/ADAPTER_DEVELOPER.md) for detailed patterns and the [Verification Policy](../docs/VERIFICATION_POLICY.md) for submission evidence.

## License

MIT
