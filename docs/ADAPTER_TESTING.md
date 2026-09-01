# OpenAsset Adapter Testing Environment

This is the local testing environment for adapter developers. It uses Hardhat, deterministic mocks, a local in-memory EVM, and an integration fixture that exercises a custom adapter alongside asset, oracle, compliance, and liquidation behavior.

## Quick start

```bash
cd contracts
npm install
npm run compile
npx hardhat test test/adapter-environment/AdapterEnvironment.test.ts
npx hardhat test test/unit/ExampleOracleAdapter.test.ts
```

The environment runs without a wallet, deployed testnet contracts, or external RPC dependencies. Hardhat creates a fresh local chain for each test run.

## Test commands

| Purpose | Command | Evidence produced |
|---|---|---|
| Compile all contracts | `npm run compile` | Solidity compiler output and generated artifacts |
| Run environment integration tests | `npx hardhat test test/adapter-environment/AdapterEnvironment.test.ts` | Human-readable pass/fail assertions |
| Run the full adapter unit suite | `npx hardhat test test/unit/` | Adapter-specific unit and adversarial results |
| Measure gas | `REPORT_GAS=true npx hardhat test test/adapter-environment/AdapterEnvironment.test.ts` | Gas report for transaction paths |
| Run coverage | `npx hardhat coverage` | Statement, branch, function, and line coverage |
| Test against a local node | `anvil` then `npx hardhat test --network localhost test/adapter-environment/AdapterEnvironment.test.ts` | Local-node integration evidence |

## Available fixtures

The test-only fixtures live in `contracts/src/mocks/` and `contracts/src/mocks/adapters/`.

| Fixture | Scenario |
|---|---|
| `MockERC20` | Mintable collateral and lending asset with configurable decimals |
| `MockChainlinkFeed` | Positive, zero, negative, stale, and timestamp-controlled feed responses |
| `MockOracleAdapter` | Settable trusted/untrusted prices, historical prices, and forced reverts |
| `MockComplianceAdapter` | Default eligibility, per-address overrides, and forced registry failures |
| `MockLiquidationAdapter` | Synchronous or asynchronous mode, configurable recovery split, and forced reverts |
| `MockLiquidationMarket` | Safe caller context for liquidation adapter invocation and loan details |
| `ReentrancyAttacker` | Adversarial callback and reentrancy scenarios |

The repository's `ExampleOracleAdapter` is a custom adapter fixture. The environment test configures it for a market and verifies that the configured quote is only available to the configured market.

## Required scenarios before submission

Every adapter must test the happy path, two-market multi-tenancy isolation, unauthorized callers, zero and invalid inputs, unconfigured-market behavior, dependency failure behavior, and bounded gas. Asset adapters must additionally check actual escrow and release balance deltas. Oracle adapters must check decimal normalization, stale data, invalid prices, trust signals, and historical semantics. Compliance adapters must prove fail-closed behavior. Liquidation adapters must prove that returned values reconcile with actual balances and cover both synchronous and asynchronous modes. Position adapters must test clone initialization, owner isolation, mint/burn authorization, and compliance-gated transfers.

A submission is incomplete if it only shows that a function returns expected values. Include the command, commit hash, network configuration, relevant test names, pass count, gas findings, dependency assumptions, and known limitations.

## Writing a custom adapter test

Copy `test/adapter-environment/AdapterEnvironment.test.ts` into your adapter project and replace `ExampleOracleAdapter` with the custom contract. Deploy the required mocks in `beforeEach`, configure the adapter through the factory signer, and call runtime functions through a market signer. This distinction catches accidental use of `tx.origin` and missing `msg.sender`-keyed configuration.

A minimal oracle assertion is:

```ts
const [price, trusted, updatedAt] = await adapter.connect(market).getPrice();
expect(price).to.equal(expectedPrice);
expect(trusted).to.equal(true);
expect(updatedAt).to.be.greaterThan(0);
```

For failure testing, configure the mock dependency to revert, return stale data, return a negative value, or report an ineligible participant. Assert a revert or the documented fail-closed sentinel. Never assert success for an unavailable dependency.

## Submission and verification link

The test matrix is the evidence required by [`ADAPTER_SPECIFICATION.md`](./ADAPTER_SPECIFICATION.md#7-testing-requirements) and is reviewed against the checklist in [`VERIFICATION_POLICY.md`](./VERIFICATION_POLICY.md#2-checklist). The developer workflow is described in [`ADAPTER_DEVELOPER.md`](./ADAPTER_DEVELOPER.md#8-testing-requirements-before-submission). Registration remains permissionless, but an adapter is Unverified until audit governance reviews its source, tests, dependencies, and limitations.
