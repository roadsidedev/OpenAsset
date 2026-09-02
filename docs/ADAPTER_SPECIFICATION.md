# oA Adapter Specification

**Version:** 1.0.0
**Status:** Normative
**Scope:** Phase 2, Workstream B1
**Audience:** Adapter developers, market creators, reviewers, and integrators

> An adapter is a non-upgradeable smart contract that implements one OpenAsset adapter interface and supplies a bounded, fail-closed integration for an isolated lending market.

This document is the normative companion to [`ADAPTER_DEVELOPER.md`](./ADAPTER_DEVELOPER.md). The adapter-specific security controls are consolidated in [`ADAPTER_SECURITY_MODEL.md`](./ADAPTER_SECURITY_MODEL.md). If this specification conflicts with an implementation comment or an older guide, the Solidity interface and the rules in this document take precedence.

## 1. Design boundaries

The lending engine owns the loan state machine, circuit breakers, reentrancy protection, collateral balance-delta checks, and repayment/liquidation accounting. Adapters supply asset movement, pricing, eligibility, liquidation orchestration, or position representation. An adapter must not silently change core lending rules.

OpenAsset has five adapter types:

| Type | Interface | Required when | Deployment model |
|---|---|---|---|
| Asset | `IAssetAdapter` | Every market | One instance may serve many markets |
| Oracle | `IOracleAdapter` | Every market | One instance may serve many markets |
| Compliance | `IComplianceAdapter` | Only when a market has eligibility requirements | One instance may serve many markets |
| Liquidation | `ILiquidationAdapter` | Every market | One instance may serve many markets |
| Position | `IPositionAdapterInit` | Every market | EIP-1167 clone per market |

Except for position adapters, implementations **must be multi-tenant**. They store market-specific configuration keyed by the calling `LendingMarket` address. The factory calls `configure` during market deployment. Adapter methods resolve the configuration using `msg.sender`; an externally owned account or an unconfigured market must not receive a successful result.

## 2. Interface contract

The canonical interfaces are in [`contracts/src/interfaces/adapters/`](../contracts/src/interfaces/adapters/). Their callable surface is summarized below.

### 2.1 Asset adapter

```solidity
interface IAssetAdapter {
    function configure(address market, address collateralToken) external;
    function escrow(address from, uint256 amountOrId) external;
    function release(address to, uint256 amountOrId) external;
    function isTransferable(address from, address to, uint256 amountOrId) external view returns (bool);
}
```

`escrow` moves collateral from `from` into the calling market. `release` moves collateral from the calling market to `to`. The adapter must use the correct token approval model and must not assume that the market has approved the adapter unless the factory configuration establishes that approval. The engine verifies actual balance changes, including for fee-on-transfer or rebasing assets.

`isTransferable` is a pre-flight check, not an authorization grant. It must return `false` for invalid addresses, zero amounts, insufficient balance, insufficient allowance, issuer freezes, or any dependency failure.

### 2.2 Oracle adapter

```solidity
interface IOracleAdapter {
    function configure(address market, address asset) external;
    function getPrice() external view returns (uint256 price, bool isTrusted, uint256 updatedAt);
    function getHistoricalPrice(uint256 secondsAgo) external view returns (uint256);
}
```

`price` is denominated in USD with 18 decimals. `updatedAt` is the source observation timestamp. `isTrusted` is one combined signal covering source validity, positive price, freshness, sequencer status, market-session constraints, and any adapter-specific safety checks. An invalid or unavailable source must produce `isTrusted == false` (and normally `price == 0`); it must never be treated as a valid zero-price quote.

`getHistoricalPrice` must return the price for the requested lookback. If the dependency cannot provide genuine historical data, it must return `0` or revert as documented; it must not mislabel the latest price as historical.

### 2.3 Compliance adapter

```solidity
interface IComplianceAdapter {
    function configure(address market) external;
    function isEligible(address participant) external view returns (bool);
}
```

Compliance is fail-closed. An unconfigured market, zero address, unavailable registry, malformed response, or dependency revert must return `false` or revert. The engine checks eligibility at loan origination and, for transferable positions, before a position is transferred.

### 2.4 Liquidation adapter

```solidity
interface ILiquidationAdapter {
    function configure(address market, address assetAdapter) external;
    function liquidate(uint256 loanId, uint256 debtOwed)
        external returns (uint256 recoveredForLP, uint256 returnedToHolder);
    function isAsynchronous() external view returns (bool);
    function cureWindowSeconds() external view returns (uint256);
    function requiresCollateralHandoff() external view returns (bool);
}
```

`liquidate` is callable by the configured market only. The two return values describe the intended economic split: the amount recovered for the liquidity provider and the surplus returned to the position holder. They must reconcile with actual token balance deltas verified by the engine. Synchronous adapters must orchestrate collateral movement through the configured asset adapter and must not custody collateral directly. Asynchronous adapters must document their request and settlement lifecycle, cure window, keeper permissions, and failure recovery.

`isAsynchronous` and `requiresCollateralHandoff` are immutable behavioral declarations for a deployed adapter configuration. `cureWindowSeconds` must be zero for synchronous adapters and positive for asynchronous adapters.

### 2.5 Position adapter

```solidity
interface IPositionAdapterInit is IPositionAdapter {
    function initialize(address factory, address complianceAdapter) external;
}

interface IPositionAdapter {
    function mint(address to, uint256 loanId) external;
    function ownerOf(uint256 loanId) external view returns (address);
    function burn(uint256 loanId) external;
}
```

Position implementations are deployed as EIP-1167 clones. They must use OpenZeppelin `Initializable`, allow initialization once, and restrict `mint` and `burn` to authorized markets. `ownerOf` is the single source of truth for the current party authorized to repay, transfer, or receive liquidation surplus. The template itself must not be usable as a market position store.

## 3. Inputs and outputs

All addresses must be checked for non-zero values unless the interface explicitly permits `address(0)` (for example, an optional compliance adapter or optional sequencer feed). Amounts and IDs must be validated for the operation. Adapter inputs must not be trusted merely because they originate from the engine; the adapter must still reject impossible or unsafe values.

All output values must be bounded and semantically defined. Prices use 18-decimal USD normalization. Timestamps must be source timestamps, not a fabricated current timestamp. Boolean trust and eligibility values must fail closed. Liquidation amounts must not exceed the collateral or debt context and must be reconciled by the engine.

## 4. Permissions and call context

| Operation | Authorized caller | Required behavior |
|---|---|---|
| `configure` | Market factory only | Configure once for a non-zero market; reject unauthorized callers |
| Asset/oracle/compliance/liquidation runtime calls | Configured market only | Resolve `marketConfigs[msg.sender]`; reject or fail closed when absent |
| Position `initialize` | Factory during clone deployment | One-time initialization |
| Position `mint`/`burn` | Authorized market only | Reject every other caller |
| Adapter-specific feed, pool, policy, or owner updates | Explicit owner/governance role | Document role, rotation, and emergency behavior; never make runtime updates permissionless |

Adapters must not use `tx.origin` for authorization. A factory-only configuration call must not be replaceable by an arbitrary market creator calling the adapter directly.

## 5. Failure behavior and security assumptions

Adapters must use checks-effects-interactions internally, avoid unbounded loops in transaction-path functions, and use `SafeERC20` or equivalent safe transfer handling. External dependency failures must not become a valid quote, eligible participant, successful transfer, or fabricated liquidation result. Reverts are acceptable where the core engine can safely handle them; otherwise return the documented fail-closed sentinel.

The core engine provides external reentrancy guards and validates critical outputs, but an adapter remains responsible for its own state transitions and callback assumptions. Developers must document every external contract, oracle, registry, issuer, router, token behavior assumption, and trust or economic dependency. Unsupported token behavior, oracle manipulation, stale data, sequencer downtime, issuer freezes, and unavailable redemption must have explicit outcomes.

Adapter code is assumed to be adversarially callable through a configured market. Do not rely on the caller being an EOA, on a friendly token, or on a dependency always returning ABI-conforming data.

## 6. Upgrade and versioning policy

Adapters are **non-upgradeable by default**. Do not place a proxy behind an adapter address. A logic change requires a new deployed adapter address, a new registry entry, and a new verification review. Existing markets continue to reference their selected adapter; changing a registry record does not silently change deployed market behavior.

Every adapter release must expose or document:

| Field | Requirement |
|---|---|
| Semantic version | `MAJOR.MINOR.PATCH`, with interface-breaking changes increasing MAJOR |
| Source commit | Immutable repository commit used for deployment and review |
| Interface revision | Exact OpenAsset interface revision implemented |
| Dependencies | Addresses, versions, feeds, pools, registries, and issuer contracts |
| Configuration compatibility | Whether existing market configuration can be reused |
| Migration plan | New-market-only, coordinated market migration, or no migration |

A patch release fixes implementation defects without changing the interface or economic meaning. A minor release may add backward-compatible functionality. A major release changes behavior or an interface and requires explicit adoption by new markets.

## 7. Testing requirements

Before registration, the developer must run the applicable matrix and attach reproducible results:

| Test category | Minimum assertion |
|---|---|
| Happy path | Adapter works in a market loan lifecycle |
| Multi-tenancy | Two markets share one instance without configuration or state leakage |
| Access control | Unauthorized factory, market, owner, and position calls fail |
| Adversarial inputs | Zero addresses, zero amounts, invalid IDs, malformed dependencies fail safely |
| Unconfigured market | EOA or unrelated market cannot obtain a successful runtime result |
| Dependency failure | Stale, reverted, unavailable, frozen, or invalid dependency fails closed |
| Accounting | Asset and liquidation outputs reconcile to actual balance deltas |
| Reentrancy/CEI | Callback and malicious-token scenarios do not corrupt state |
| Gas | Transaction-path gas is bounded and no unbounded iteration exists |
| Upgrade/version | Source commit, version, and deployment configuration are reproducible |

Position adapters additionally test clone initialization, template isolation, owner isolation, and compliance-gated transfers. Oracle adapters additionally test decimal normalization and historical-data semantics. Compliance adapters additionally prove fail-closed behavior. Liquidation adapters additionally test synchronous and asynchronous paths, cure windows, handoff declarations, and surplus reconciliation.

## 8. Verification and submission requirements

Registration is permissionless and does not imply verification. The developer submits the deployed address, adapter type, version, source commit, interface revision, configuration instructions, external dependency list, test report, known limitations, and economic assumptions. The adapter is initially **Unverified**.

Audit governance reviews the source and evidence for interface compliance, functional correctness, access control, failure handling, oracle behavior, liquidation reconciliation, reentrancy risk, input validation, upgrade risk, economic assumptions, and compliance claims. A **Verified** mark means that governance reviewed the committed source and evidence against this checklist. It does not guarantee safety, performance, solvency, or economic success. A **Deprecated** mark blocks new selection but does not automatically pause existing markets.

The authoritative process is [`VERIFICATION_POLICY.md`](./VERIFICATION_POLICY.md). The registry contract is [`AdapterRegistry.sol`](../contracts/src/AdapterRegistry.sol).

## 9. Minimal developer workflow

1. Select the exact adapter type and interface.
2. Implement the multi-tenant or clone pattern described above.
3. Add NatSpec for all public functions, assumptions, failure states, and dependencies.
4. Add unit, integration, adversarial, and gas tests from Section 7.
5. Run `npm install`, `npm run compile`, and the relevant test command in `contracts/`.
6. Deploy a non-upgradeable adapter with a recorded version and source commit.
7. Register the address in `AdapterRegistry`; expect the initial status to be Unverified.
8. Submit the verification package and update the registry only through audit governance.

## References

[1]: ../contracts/src/interfaces/adapters/index.sol "OpenAsset adapter interface index"
[2]: ./ADAPTER_DEVELOPER.md "OpenAsset Adapter Framework Developer Guide"
[3]: ./ADAPTER_TESTING.md "OpenAsset Adapter Testing Environment"
[4]: ./VERIFICATION_POLICY.md "OpenAsset Adapter Verification Policy"
[5]: ../contracts/src/AdapterRegistry.sol "OpenAsset Adapter Registry"
