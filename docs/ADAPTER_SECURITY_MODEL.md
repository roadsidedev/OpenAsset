# OpenAsset Adapter Security Model

**Version:** 1.0.0
**Status:** Normative security policy for Workstream C3
**Scope:** Asset, oracle, compliance, liquidation, and position adapters; `AdapterRegistry`; market factory wiring; verification and incident response

> Adapters are an explicit trust boundary. A registry badge, audit reference, or factory configuration does not make adapter code safe. The lending engine must continue to validate permissions, trust signals, balance deltas, and accounting independently of the adapter.

This document supplements the [Adapter Specification](./ADAPTER_SPECIFICATION.md), [Security Baseline](./SECURITY_BASELINE.md), [Verification Policy](./VERIFICATION_POLICY.md), and [Submission Workflow](./ADAPTER_SUBMISSION_WORKFLOW.md). Where this document is stricter, the stricter rule applies.

## 1. Security principles

1. **Least authority:** An adapter receives only the permissions required for its category and configured market.
2. **Market isolation:** Shared adapters key configuration and runtime behavior by the calling market. One market’s configuration or failure must not change another market’s behavior.
3. **Fail closed:** Invalid, stale, unavailable, or malformed dependencies must not become a valid price, eligible participant, transfer, or liquidation result.
4. **No implicit trust:** Registration and verification are metadata; the engine validates outputs and actual asset movement.
5. **Immutable behavior by default:** A deployed adapter address must not silently change logic or economic meaning.
6. **Reversible selection, not retroactive mutation:** New-market selection can be blocked quickly, while existing markets require an explicit pause, migration, or recovery decision.
7. **Evidence over claims:** Every permission, version, dependency, review, and emergency action must be observable through source, events, deployment records, and tests.

## 2. Permission model

### 2.1 Roles

| Role | Allowed actions | Prohibited actions | Control |
|---|---|---|---|
| Factory | Configure an adapter for a non-zero market and required asset/dependency addresses | Runtime price, transfer, eligibility, or liquidation calls on behalf of a market; arbitrary owner updates | `onlyFactory`, immutable factory where practical, chain/address manifest |
| Configured market | Invoke runtime adapter functions for its own configuration | Invoke another market’s configuration or mutate adapter policy | `marketConfigs[msg.sender]`, configured-market guard |
| Adapter owner/operator | Rotate explicitly documented dependency addresses or operational parameters | Bypass market isolation, rewrite historical configuration, or change interface semantics | Owner/multisig role, two-person review, emitted event, timelock where compatible |
| Audit governance | Mark review status, verify, reject, deprecate, and rotate registry governance | Treating verification as a safety guarantee or silently changing deployed market wiring | Multisig, review evidence, status event, C1 incident process |
| Usage reporter | Record protocol usage and secured value | Register, verify, configure, or alter adapter metadata | Dedicated address, governance rotation, event reconciliation |
| External dependency | Return data or perform narrowly defined external action | Receiving unchecked authority over core loan state or arbitrary transfers | Interface boundary, try/catch where appropriate, output and balance validation |
| Untrusted caller | Register an adapter and submit metadata | Configure or invoke a market-scoped adapter path without authorization | Permissionless registration with initial `UNREVIEWED` status |

### 2.2 Category-specific permissions

- **Asset adapters** may move only the configured collateral asset between the configured market and the specified participant. They must not hold unrelated protocol funds or choose an arbitrary token at runtime.
- **Oracle adapters** may read configured sources and return normalized quotes. Feed, pool, sequencer, and fallback changes require the documented factory/owner role and must emit an event.
- **Compliance adapters** may read eligibility policy and, where explicitly designed, receive managed allowlist updates. They must fail closed on dependency failure and must not mint, transfer, or seize assets.
- **Liquidation adapters** may orchestrate only the configured market’s liquidation and declared asset handoff. Router, redemption, auction, and slippage controls must be restricted and bounded.
- **Position adapters** are clone instances. Factory initialization is one-time; only the authorized market may mint or burn; ownership and transfer hooks must not be replaceable by a template caller.

Adapters must never use `tx.origin`, unbounded loops in transaction paths, arbitrary delegatecall, or permissionless updates to security-critical dependencies. A dependency address is a permissioned configuration value, not ordinary user input.

## 3. Verification model

Verification is a **time-bounded governance attestation against committed evidence**, not an audit guarantee, insurance policy, economic endorsement, or promise of solvency. The registry must expose at least `UNREVIEWED`, `IN_REVIEW`, `APPROVED`, and `REJECTED`, plus the legacy `verified` and `deprecated` compatibility signals.

### 3.1 Required evidence

A reviewer must bind the decision to the adapter address, chain ID, deployed bytecode, source commit, semantic version, exact interface revision, constructor/factory configuration, dependency addresses and versions, applicable template, test commands and results, gas evidence, known limitations, economic assumptions, and review reference. If any material dependency or deployed bytecode differs from the reviewed package, the status is not transferable.

### 3.2 Review gates

1. Automated checks confirm source presence, interface marker, Solidity version, prohibited authorization patterns, compilation, and the adapter environment suite.
2. Interface and deployment review confirms exact function signatures, factory binding, market isolation, initialization, and non-upgradeability.
3. Functional and adversarial review covers happy path, two-market isolation, unauthorized callers, malformed and zero inputs, dependency outages, stale/invalid oracle data, compliance denial, liquidation reconciliation, malicious tokens/callbacks, reentrancy, and gas bounds.
4. Economic review records price source, liquidity and redemption assumptions, slippage, TVL/market-size limits, bad-debt behavior, and failure recovery.
5. Governance records `IN_REVIEW`, then `APPROVED` with a durable audit reference or `REJECTED` with a stable reason reference.

A Verified adapter remains subject to live monitoring and can be deprecated or re-reviewed if dependencies, bytecode, assumptions, or observed behavior change.

## 4. Version model

Every adapter release uses semantic versioning `MAJOR.MINOR.PATCH` and records:

| Field | Rule |
|---|---|
| Major | Interface-breaking change, changed authorization, changed economic meaning, or incompatible configuration |
| Minor | Backward-compatible functionality or optional dependency support |
| Patch | Defect fix with no interface or economic meaning change |
| Source commit | Immutable Git commit used for deployment and review |
| Interface revision | Exact OpenAsset interface and specification revision |
| Dependencies | Checksummed addresses, versions, chain IDs, feeds, pools, issuers, registries, and router settings |
| Configuration compatibility | Explicitly states whether existing markets can reuse configuration |
| Migration plan | New markets only, coordinated migration, or no migration |

The registry version is descriptive metadata; it does not select code and cannot change existing market wiring. A version string without a source commit and deployed address is incomplete evidence.

## 5. Upgrade model

Adapters are non-upgradeable by default. Proxy administration, delegatecall-based logic replacement, and mutable implementation pointers are prohibited unless a future security review explicitly approves a different model. A logic or economic change requires:

1. A new adapter address and semantic version.
2. A new source commit and deployment manifest entry.
3. A new automated test and verification package.
4. A new registry entry and review decision.
5. Explicit adoption by new markets or a coordinated, independently approved migration for existing markets.

Registry metadata, verification, deprecation, and usage updates must never mutate deployed adapter behavior. Existing markets continue to reference their selected address until their own documented pause or migration path is executed.

## 6. Revocation model

Revocation is layered because registration and existing market wiring are intentionally separate:

| Layer | Action | Effect | Does not do |
|---|---|---|---|
| Review | `markRejected` | Records failed review and removes approval signal | Does not alter adapter bytecode or existing markets |
| Discovery | `markDeprecated` | Makes adapter non-selectable for new markets and surfaces warnings | Does not pause existing markets |
| Dependency | Disable feed/oracle/router or rotate a documented dependency | Stops or fails closed for affected paths | Does not recover already-issued bad debt |
| Market | Pause borrowing/new risky actions through circuit breaker or market emergency control | Contains an affected market while preserving documented repayment/recovery paths | Does not erase loans or guarantee recovery |
| Governance/key | Rotate compromised owner, factory, reporter, or audit governance key | Removes future authority from the compromised address | Does not reverse already-mined transactions |
| Migration | Deploy and verify a replacement, then explicitly reconfigure/migrate | Restores supported operation under reviewed code | Does not silently move existing markets |

A rejection or deprecation reason must identify the affected version/commit, severity, finding category, evidence reference, and remediation or re-submission expectation. Re-approval requires a new review of the fixed source; changing only the metadata is insufficient.

## 7. Emergency response

### 7.1 Trigger conditions

Initiate adapter containment for active or suspected fund loss, invalid or manipulated prices, dependency compromise, unauthorized configuration, cross-market state leakage, repeated liquidation/accounting mismatch, compliance bypass, reentrancy evidence, critical gas denial of service, or monitoring blind spots affecting a critical path.

### 7.2 Response sequence

1. **Declare:** Record chain, block, adapter address, market(s), version, source commit, dependency, transaction hashes, observed signal, and severity.
2. **Preserve:** Export logs, traces, registry events, deployment manifests, and indexer state before changing configuration where safe.
3. **Contain:** Deprecate the adapter for new markets; disable the affected feed/router/provider; trigger the affected market circuit breaker or pause control; and rotate compromised keys. Do not perform an unreviewed upgrade.
4. **Assess:** Determine affected markets, positions, assets, loans, balances, oracle intervals, user scope, and whether the issue is isolated or systemic. Reconcile on-chain balances against indexer records.
5. **Recover:** Deploy/reconfigure a reviewed replacement only through authorized governance, run regression and invariant tests, execute an explicit market migration or restart plan, and verify monitoring before unpause.
6. **Communicate and close:** Publish facts and limitations, maintain a timeline, obtain security sign-off, document root cause and corrective actions, and update the threat model and test matrix.

Emergency actions must be least-privilege, independently acknowledged for SEV-1 events, and fully event/log recorded. Automatic responses may pause or disable a source; they must never automatically unpause, weaken slippage/freshness bounds, or mark an adapter Verified.

## 8. Required monitoring

The indexer and alerting system must monitor adapter registration and metadata, verification/rejection/deprecation, configuration and owner changes, source/feed/router changes, oracle trust and freshness, compliance failure rates, liquidation success and recovery ratios, asset balance deltas, market concentration by adapter, gas p95/p99, and failed calls. Alerts require severity, threshold, owner, runbook, acknowledgement, and closure records. Monitoring loss on a critical adapter path is itself an incident.

## 9. Developer and reviewer checklists

### Developer must prove

- Exact interface and factory/market permission model.
- Two-market isolation and unconfigured-caller behavior.
- Fail-closed dependency and oracle behavior.
- Asset/liquidation balance reconciliation.
- Reentrancy/CEI and malicious dependency resistance.
- Bounded gas and no uncontrolled iteration.
- Non-upgradeable deployment, source commit, version, dependencies, and migration plan.
- Emergency disable, deprecation, and recovery assumptions.

### Reviewer must record

- Reviewed address, chain, bytecode, commit, version, and interface revision.
- Automated commands and immutable results.
- Findings by severity and stable taxonomy.
- Dependency and economic assumptions.
- Approval, rejection, or deprecation reference.
- Expiry/re-review trigger and monitoring owner.

## 10. Security boundary statement

An adapter is a replaceable integration boundary, not a trusted extension of the lending engine. The engine remains responsible for authorization around core state, collateral balance deltas, output bounds, reentrancy protection, and market isolation. The adapter remains responsible for its own permissions, dependency handling, accounting claims, and declared assumptions. Users and market creators must treat an unverified or verified adapter as a risk choice, not as a protocol guarantee.

## References

- [Security Baseline](./SECURITY_BASELINE.md)
- [Adapter Specification](./ADAPTER_SPECIFICATION.md)
- [Adapter Testing Environment](./ADAPTER_TESTING.md)
- [Adapter Verification Policy](./VERIFICATION_POLICY.md)
- [Adapter Submission Workflow](./ADAPTER_SUBMISSION_WORKFLOW.md)
- [Adapter Registry](../contracts/src/AdapterRegistry.sol)
