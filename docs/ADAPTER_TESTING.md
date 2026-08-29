# Adapter Testing Environment

## Quick Start

```bash
# Start local chain
anvil --fork-url $BASE_SEPOLIA_RPC_URL

# Run adapter matrix for an adapter
npx hardhat test test/unit/ERC20Adapter.test.ts --network localhost
# Or via fizz/invariant
forge test --match-contract ERC20AdapterHandler
```

## Mock Suite (`contracts/src/mocks/`)

| Mock | Purpose |
|------|---------|
| `MockERC20`, `MockB20`, `MockRobinhoodToken` | Collateral/lending assets with mint/approve |
| `MockChainlinkFeed` | `latestRoundData` with staleness control |
| `MockUniswapV3Router` | `exactInputSingle` with `amountOut` return |
| `MockPolicyRegistry` | `isAuthorized(policyId, account)` |
| `MockAssetAdapter`, `MockOracleAdapter`, `MockLiquidationAdapter`, `MockComplianceAdapter`, `MockPositionAdapter` | Fuzz handlers for invariant tests |
| `ManipulatedOracleAdapter` | Returns `price==0` or stale to test `isTrusted==false` |

## Test Matrix (required before submission, per ADAPTER_DEVELOPER.md §8)

1. **Happy path** — deploy market via `MarketFactoryV2.createMarket` with your adapter, `requestLoan`, `repay`/`liquidate` succeed.
2. **Multi-tenancy isolation** — configure two markets with same adapter instance (different collateral), assert `marketConfigs[marketA] != marketConfigs[marketB]`.
3. **Position isolation** — two markets with same loanId (0) mint positions; verify `ownerOf(0)` on cloned adapters are isolated (different contracts) or per-market mapping.
4. **Adversarial** — zero address, zero amount, nonexistent loanId must revert, not return true/0.
5. **Unconfigured-market** — call adapter from EOA (not market) must revert `Unconfigured market`.
6. **Liquidation reconciliation** — for liquidation adapters, assert `recoveredForLP == balanceAfter - balanceBefore` else `AdapterUnderDelivered`.
7. **Compliance hook** — `TransferablePositionAdapter` transfer to ineligible must revert `Transfer blocked: recipient not eligible`.

## Gas Testing

```
REPORT_GAS=true npx hardhat test
```

Assert `requestLoan` < 250k, `repay` < 180k, `liquidate` sync < 350k.

## Example: Test ERC20Adapter

```ts
it("isTransferable checks market allowance, not adapter", async () => {
  await token.mint(borrower.address, 1000);
  await token.connect(borrower).approve(market.address, 1000); // not adapter
  expect(await erc20Adapter.connect(market).isTransferable(borrower.address, market.address, 1000)).to.be.true;
  // approve adapter only should be false
  await token.connect(borrower).approve(adapter.address, 1000);
  await token.connect(borrower).approve(market.address, 0);
  expect(await erc20Adapter.connect(market).isTransferable(borrower.address, market.address, 1000)).to.be.false;
});
```
