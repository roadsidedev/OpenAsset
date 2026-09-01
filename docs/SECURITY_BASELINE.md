# OpenAsset Security Baseline

**Version:** 1.0.0
**Owner:** Security and Trust workstream
**Scope:** OpenAsset contracts, adapter platform, oracle integrations, deployment operations, backend monitoring, and registry governance
**Status:** Baseline for Phase 1 C1; update after material architecture or threat changes

> This baseline is a risk-management and response framework. It is not an audit, warranty, or claim that the protocol is safe. Verification marks and monitoring reduce uncertainty; they do not eliminate smart-contract, oracle, market, operational, legal, or economic risk.

## 1. Security objectives

OpenAsset must preserve the isolation of each lending market, protect lender and borrower accounting, use only valid and sufficiently fresh risk inputs, fail closed when dependencies are unavailable, restrict privileged operations, and provide enough telemetry to detect and contain abnormal behavior. A security control is considered effective only when its owner, trigger, response, and evidence are defined.

The baseline assumes permissionless market and adapter registration, non-upgradeable adapters by default, factory-configured multi-tenant adapters, external oracle and token dependencies, and governance-controlled emergency and verification actions. Existing markets must not be silently reconfigured by registry metadata changes.

## 2. Threat model

### 2.1 Actors

| Actor | Capability | Security concern |
|---|---|---|
| Untrusted external caller | Creates markets, registers adapters, submits loans and repayments, calls public protocol functions | Malformed inputs, griefing, denial of service, economic manipulation |
| Borrower or position holder | Supplies collateral, borrows, repays, transfers eligible positions where enabled | Undercollateralization, transfer abuse, liquidation avoidance |
| Liquidity provider | Supplies lending liquidity and receives repayment/liquidation proceeds | Bad debt, accounting loss, manipulated price or liquidation output |
| Adapter developer | Deploys external adapter and declares dependencies and assumptions | Malicious or defective asset movement, oracle, compliance, or liquidation logic |
| Oracle/issuer/registry dependency | Supplies prices, NAV, eligibility, policy or reserve data | Stale, invalid, manipulated, unavailable, or selectively censored data |
| Market creator | Chooses adapters and risk parameters for an isolated market | Unsafe configuration, excessive LTV, unsafe dependencies, parameter griefing |
| Keeper/monitor | Submits or triggers operational responses where configured | Missed response, false positive, compromised automation |
| Audit governance multisig | Verifies, rejects, deprecates adapters, controls registry governance | Key compromise, collusion, incorrect review, delayed response |
| Protocol operator/deployer | Deploys contracts and configures providers and networks | Wrong chain/address, leaked deployer key, incomplete verification |
| Blockchain adversary | Front-runs, sandwiches, flash-loans, reorders transactions within consensus limits | Oracle manipulation, liquidation extraction, timing and MEV attacks |

### 2.2 Trust boundaries and assumptions

The lending engine is trusted to enforce its state machine, reentrancy protection, circuit breakers, and balance-delta accounting. Adapters and external dependencies are **not** trusted. A configured market caller may be a contract and may be adversarial. Tokens may be fee-on-transfer, rebasing, frozen, callback-capable, or otherwise non-standard unless explicitly supported. Oracles may return stale, zero, negative, inconsistent, or unavailable values. Governance keys, deployment keys, RPC providers, monitoring credentials, and notification channels are operational trust boundaries and require separate protection.

The frontend is not a security boundary. Backend validation and database controls are not substitutes for on-chain authorization. Registry registration is permissionless and does not imply verification. A Verified status is a bounded review signal, not insurance or guaranteed solvency.

## 3. Critical contract inventory

| Component | Criticality | Why it matters | Required controls and evidence |
|---|---:|---|---|
| `MarketFactoryV2` | Critical | Creates isolated markets and wires adapters/providers | Factory authorization, parameter bounds, correct implementation addresses, deployment manifest, invariant tests |
| `LendingMarketV2` | Critical | Holds liquidity, originates loans, enforces collateral, repayment, and liquidation accounting | Reentrancy/CEI, pause/circuit breaker, balance-delta checks, authorization, full lifecycle and fuzz tests |
| `LoanContract` / `LoanContractV2` | Critical | Stores and transitions individual loan state | State-machine invariants, repayment and liquidation authorization, no double settlement, event monitoring |
| `MarketDeployer` | High | Deploys market components and initialization wiring | Init-once checks, deterministic address/configuration tests, deployment dry runs |
| `AdapterRegistry` | High | Central discovery, verification, deprecation, metadata, and usage signal | Governance multisig, event/indexer reconciliation, status transition tests, no implication of safety |
| `OracleRouter` and `ChainlinkOracle` | Critical | Selects, disables, and serves market price inputs | Freshness, positive-answer, sequencer, fallback, emergency-disable and manipulation tests |
| `NFTOracle` | Critical | Prices NFT collateral and supports fallback/emergency behavior | Collection authorization, stale/fallback policy, updater access control, price bounds, pause tests |
| `CircuitBreaker` | Critical | Pauses unsafe market activity after configured volatility or risk triggers | Threshold tests, fail-safe pause semantics, alerting, authorized reset, event monitoring |
| Adapter contracts | Critical per market | Move collateral, price assets, enforce compliance, or execute liquidation | Interface, isolation, access control, failure, dependency, accounting, gas, and verification checklist |
| Position adapters | High | Define ownership and transferability of positions | Clone initialization, mint/burn authorization, owner isolation, compliance-gated transfer tests |
| Deployment manifests and provider bundles | High | Bind addresses, feeds, routers, registries, and network assumptions | Checksummed addresses, chain-ID checks, independent review, read-only verification |

Any change to a Critical component requires security review, targeted regression tests, an updated threat assessment, and a deployment/rollback plan. A dependency address change is a security-relevant change even when Solidity bytecode is unchanged.

## 4. Critical attack paths

| Attack path | Preconditions and impact | Preventive controls | Detection and response |
|---|---|---|---|
| Price manipulation causes excess borrowing | Thin/incorrect spot source, stale feed, or flash-loan movement makes collateral appear valuable | TWAP/Chainlink freshness, positive-value checks, sequencer checks, trust flags, circuit breakers, isolated markets | Price deviation and utilization alerts; disable affected oracle/feed, pause market, assess loans |
| Oracle outage or fallback abuse | Dependency reverts, returns malformed data, or fallback is stale; bad debt or denial of service | Fail-closed sentinel/revert, explicit fallback policy, staleness limits, emergency disable | Dependency failure-rate alerts; disable source and communicate affected markets |
| Unauthorized adapter configuration | Attacker configures market or changes router/feed/policy | Factory/owner governance gates, immutable factory where applicable, no `tx.origin` | Monitor configuration events and unexpected caller; deprecate adapter, rotate dependency |
| Cross-market configuration leakage | Shared adapter uses global state or wrong caller key; one market affects another | `marketConfigs[msg.sender]`, two-market isolation tests, registry metadata does not rewire markets | Compare configuration/event state by market; quarantine adapter and stop new selection |
| Collateral theft or accounting mismatch | Malicious token, under-delivery, wrong approval, or liquidation output exceeds actual balances | Safe transfer handling, balance-delta checks in engine, asset adapter tests, no direct unverified custody | Track token deltas, abnormal reserve changes, failed transfer/liquidation events; pause market |
| Liquidation manipulation or griefing | Untrusted quote, router slippage, async settlement failure, or keeper censorship | Minimum output, trust signal, slippage caps, cure window and handoff declarations, reconciliation | Liquidation failure and recovery-ratio alerts; disable route, preserve collateral, review bad debt |
| Reentrancy and callback corruption | Token/router/NFT callback re-enters borrow, repay, transfer, or liquidation | Reentrancy guards, CEI, SafeERC20, malicious-token and attacker tests | Reverted nested calls, invariant violations, abnormal call traces; pause and investigate |
| Compliance bypass | Registry outage, malformed response, stale allowlist, or unchecked transfer hook | Fail-closed compliance, explicit policy IDs, eligibility before origination/transfer | Eligibility failure and policy-change alerts; block affected adapter/market |
| Governance or deployer key compromise | Privileged actor changes feeds, routers, verification, or emergency state | Multisig, least privilege, hardware keys, timelocks where compatible, address allowlists | Privileged-event alerts and signer anomaly detection; revoke/rotate keys, deprecate dependencies |
| Registry trust confusion | Users mistake registration or Verified mark for safety guarantee | Explicit status semantics, review references, version/commit metadata, deprecation warnings | Monitor stale review metadata and usage concentration; update status and publish findings |
| Denial of service / gas exhaustion | Unbounded loops, griefing registrations, oversized calldata, or dependency gas behavior | Bounded loops, gas tests, per-market isolation, input limits | Gas percentile alerts and failed transaction spikes; cap/disable affected path |
| Upgrade or deployment drift | Proxy or implementation mismatch silently changes behavior | Non-upgradeable adapter policy, source commit/version, bytecode verification, manifest diff review | Bytecode and implementation drift monitoring; freeze deployment and require re-review |

## 5. Monitoring requirements

Monitoring must be event- and state-based, run independently of the frontend, and retain enough context to reconstruct an incident. The indexer should ingest at minimum market creation/configuration, adapter registration and metadata changes, verification/rejection/deprecation, governance changes, oracle/feed activation and disabling, circuit-breaker triggers/resets, loan origination/repayment/liquidation, collateral and liquidity transfers, position mint/burn/transfer, compliance configuration changes, and failed transaction/error rates.

| Monitor | Minimum signal | Suggested alert threshold | Owner / response |
|---|---|---|---|
| Oracle health | Freshness, trust flag, answer sign, deviation, sequencer status | Any critical market becomes untrusted; deviation exceeds market threshold | On-call: disable source, pause market if needed |
| Market solvency | Liquidity, collateral, debt, utilization, bad debt, reserve delta | Reserve shortfall, unexpected negative balance delta, utilization ceiling breach | Risk owner: pause borrowing, reconcile balances |
| Liquidation | Success/failure, recovery ratio, slippage, cure-window expiry | Repeated failures, recovery below floor, stuck async request | Liquidation owner: disable route and preserve collateral |
| Privileged actions | Caller, target, old/new value, chain ID | Any unplanned governance/factory/owner change | Security owner: verify signer and freeze/rotate |
| Adapter behavior | Reverts, gas p95/p99, configuration isolation, usage concentration | Error-rate or gas spike; adapter exceeds concentration limit | Adapter owner: mark review/deprecated and investigate |
| Compliance | Eligibility failure/revert, policy changes, transfer denials | Registry outage or unexpected policy mass change | Compliance owner: fail closed and notify markets |
| Infrastructure | RPC lag, indexer delay, worker heartbeat, queue depth | Missing heartbeat or stale block ingestion beyond SLA | Operations: fail over provider and preserve evidence |

Alerts must have severity, deduplication, escalation, runbook link, and acknowledgement/closure timestamps. Alerting must not automatically unpause or weaken a control. Monitoring loss is itself an incident condition for critical paths.

## 6. Incident response process

### 6.1 Severity

**SEV-1** is active or imminent loss of funds, cross-market contagion, compromised governance/deployer key, or an invalid oracle affecting borrowing or liquidation. **SEV-2** is a contained market loss risk, adapter failure, compliance bypass risk, or critical monitoring outage without confirmed loss. **SEV-3** is a non-critical defect, documentation issue, or isolated operational degradation.

### 6.2 Response phases

1. **Detect and declare.** The discoverer records UTC time, chain and block, affected contract/market/adapter, observed symptoms, alert IDs, and severity. The incident commander is assigned immediately for SEV-1/2.
2. **Contain.** Preserve logs and RPC traces before mutation where possible. Use only documented emergency controls: pause affected market activity, disable the affected oracle/feed/router, block new adapter selection, or revoke/rotate a compromised privileged key. Do not upgrade or redeploy in haste.
3. **Assess.** Determine affected markets, assets, loans, users, blocks, transactions, dependency versions, and whether funds are at risk. Compare on-chain state with indexer state and record all assumptions.
4. **Eradicate and recover.** Fix or replace the dependency/adapter, reconfigure only through authorized governance, reconcile balances and loan states, and run the relevant regression and invariant suite. Existing markets must receive an explicit migration decision; registry changes alone do not alter deployed market wiring.
5. **Communicate.** Maintain an internal timeline and publish user-facing status appropriate to severity. State facts, affected scope, actions taken, limitations, and next update time. Do not claim safety or recovery until verified.
6. **Close and learn.** Require security sign-off, evidence of monitoring restoration, post-incident review, root cause, contributing factors, customer impact, corrective actions with owners/dates, and an updated threat model/test case.

### 6.3 Evidence and contact controls

The incident record must include immutable transaction links, block ranges, contract addresses, deployment commit, alert payloads, RPC/indexer exports, governance approvals, communication copies, and recovery reconciliation. Secrets, private keys, and personal data must not be placed in public tickets or repository history. Security reports should use the repository's security contact/process when available; critical exploit details should be shared only with the incident commander and designated security responders until containment.

## 7. Release and change gates

A release touching a Critical component must pass compilation, unit tests, integration tests, adversarial/reentrancy tests, property or fuzz tests where available, gas regression checks, deployment dry run, manifest/address review, and documentation update. A dependency or parameter change must include a before/after risk assessment. Adapter releases must also pass the [adapter verification checklist](./VERIFICATION_POLICY.md), the [testing environment](./ADAPTER_TESTING.md), and the [submission workflow](./ADAPTER_SUBMISSION_WORKFLOW.md).

## 8. Baseline acceptance checklist

- [x] Threat model and actors documented.
- [x] Critical contracts and operational components identified.
- [x] Critical attack paths documented with controls and responses.
- [x] Monitoring signals, thresholds, owners, and escalation expectations documented.
- [x] Incident severity, containment, assessment, recovery, communication, and postmortem process documented.
- [ ] Named production on-call rotation and contact channels approved by operations.
- [ ] Chain-specific alert thresholds and pause authority approved before production launch.
- [ ] Independent security review and disaster-recovery exercise completed before handling production funds.

The final three items are deliberately operational approvals, not claims that documentation alone completes production readiness.

## References

- [Adapter Specification](./ADAPTER_SPECIFICATION.md)
- [Adapter Testing Environment](./ADAPTER_TESTING.md)
- [Adapter Verification Policy](./VERIFICATION_POLICY.md)
- [Adapter Submission Workflow](./ADAPTER_SUBMISSION_WORKFLOW.md)
- [Circuit Breaker implementation](../contracts/src/libraries/CircuitBreaker.sol)
- [Oracle Router implementation](../contracts/src/oracles/OracleRouter.sol)
- [Adapter Registry implementation](../contracts/src/AdapterRegistry.sol)
