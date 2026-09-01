# Adapter Submission Workflow

This workflow defines how an adapter moves from local development to a registry review outcome. It is intentionally evidence-based so another developer can complete a submission without founder support.

## Workflow

```text
Developer builds adapter
  → runs local template and environment tests
  → runs automated submission checks
  → submits source, commit, metadata, dependencies, and test report
  → governance marks IN_REVIEW
  → human review checks the 11-point verification checklist
  → governance marks APPROVED or REJECTED with a reference
  → registry and UI expose the resulting status
```

## Automated checks

Run from the repository root:

```bash
cd contracts
./scripts/check-adapter-submission.sh oracle src/adapters/oracle/ChainlinkAdapter.sol
```

The checker validates that the source exists, declares the expected adapter interface, uses Solidity `^0.8.20`, does not use `tx.origin`, compiles the repository, and passes the adapter environment integration suite. It is a fast gate, not a security review.

## Submission package

The developer submits the deployed address, adapter type, semantic version, source commit, interface revision, factory configuration, supported assets, documentation URI, repository URI, external dependency addresses, local test command and result, gas report, known limitations, economic assumptions, and any audit or review material. The developer registers with `registerAdapterWithMetadata`; legacy `registerAdapter` remains available but does not populate discoverability fields.

## Human review criteria

Governance reviews interface compliance, functional correctness, access control, failure handling, oracle behavior, liquidation behavior, reentrancy and CEI discipline, input validation, upgrade risk, economic assumptions, and compliance claims. Review findings must identify the affected source location, severity, expected remediation, and a durable reference. Rejections use a stable reason taxonomy such as `interface-mismatch`, `access-control`, `fail-open`, `balance-unverified`, `oracle-risk`, `economic-assumption`, or `gas-unbounded`.

The reviewer calls `markInReview` before substantive review, `markVerified(adapter, auditReference)` after all required evidence passes, or `markRejected(adapter, reasonReference)` when findings remain. A new logic version requires a new address and a new review. Verification never means guaranteed safety or solvency.

## Acceptance evidence

A submission is complete only when the automated checker passes, the focused unit and integration tests pass, gas behavior is recorded, the source commit is reproducible, metadata is populated, external dependencies and limitations are documented, and the review outcome is visible through `getAdapterMetadata` and the registry events.
