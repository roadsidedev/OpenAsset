# SDK test utilities

The SDK keeps test utilities dependency-light so adapter projects can choose Hardhat, Foundry, or another local EVM runner. The `smoke-test.js` command verifies that all published SDK components are present in the package.

For integration tests, import the Solidity interfaces and use the repository's mocks from `contracts/src/mocks/` as fixtures. Adapter submissions must still run the full matrix in [`docs/ADAPTER_TESTING.md`](../../docs/ADAPTER_TESTING.md), including multi-tenancy isolation, adversarial inputs, unconfigured callers, dependency failures, and accounting reconciliation.
