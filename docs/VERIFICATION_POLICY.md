# Adapter Verification Policy
**Owner:** Audit Governance Multisig (`AdapterRegistry.auditGovernance`)  
**Applies to:** All `AdapterType` (ASSET, ORACLE, COMPLIANCE, LIQUIDATION, POSITION)

This policy is implemented within the broader [`ADAPTER_SECURITY_MODEL.md`](./ADAPTER_SECURITY_MODEL.md), which defines adapter permissions, versioning, upgrade, revocation, and emergency controls.

## 1. What Verification Means

- `verified == true` means the audit governance has reviewed source, tests, and external dependencies and **attests** the adapter implements its interface correctly and fails closed.
- It does **NOT** mean funds are safe, economic assumptions are sound, or the adapter is bug-free. Markets remain isolated; verification is a **trust signal**, not insurance.
- `deprecated == true` blocks new markets (`isSelectable==false`) but does NOT pause existing markets using the adapter.

## 2. Checklist (11 points, per playbook B6)

| # | Check | Evidence Required |
|---|-------|-------------------|
| 1 | Interface compliance | Source matches `IAssetAdapter`/`IOracleAdapter`/etc exactly, including `configure` sig |
| 2 | Functional correctness | Happy path wired to a test market on Base Sepolia, loan lifecycle succeeds |
| 3 | Access control | `configure`/`registerFeed`/`registerPool` etc gated `onlyFactory`/`onlyOwner`; `mint/burn` onlyMarket |
| 4 | Failure handling | Unconfigured market reverts or returns `false`; `isTrusted==false` on bad feed; compliance returns `false` on revert |
| 5 | Oracle behavior | Staleness, sequencer down, weekend window → `isTrusted==false`; `MAX_SANE_PRICE` enforced; `getHistoricalPrice` genuine or 0 |
| 6 | Liquidation behavior | `recoveredForLP`/`returnedToHolder` reconcile to balance deltas; `requiresCollateralHandoff` correct; async adapters return `(0,0)` on submit |
| 7 | Reentrancy risk | No state after external call without `nonReentrant`; CEI ordering; `SafeERC20` used |
| 8 | Input validation | Zero address/amount reverts; `slippage ≤5000`; `twapPeriod 600-1800`; `maxStaleness >0` |
| 9 | Upgrade risk | Non-upgradeable, no proxy behind adapter; `immutable factory` |
| 10 | Economic assumptions | Documented: which pool/feed/issuer, what happens if unavailable, TVL cap recommendation |
| 11 | Compliance claims | For `IComplianceAdapter`: fail-closed proof, policy IDs, registry address, sentinel `0` handling |

## 3. Process

```
Developer builds adapter (ADAPTER_DEVELOPER.md §7-8)
  → runs local tests (happy, multi-tenancy isolation, adversarial zero, unconfigured, liquidation reconciliation, transfer hook)
  → deploys to target chain(s) with factory set to MarketFactoryV2 address
  → registerAdapter(adapter, type) permissionless → Unverified in registry + UI
  → submits PR to openasset-registry with: source, commit hash, auditReference, external deps, test report, known limitations
  → governance reviews against §2 checklist
  → if pass: markVerified(adapter, auditReference) → Verified badge in UI
  → if fail: comment with specific findings, developer fixes and resubmits
  → if critical later: markDeprecated(adapter, reason) → new markets blocked, existing show warning
```

## 4. SLA

- Review within 5 business days of complete submission.
- Re-review within 3 business days after fixes.

## 5. Rejection Taxonomy

| Reason | Example |
|--------|---------|
| `interface-mismatch` | `configure(address,address,uint16)` sig wrong |
| `access-control` | `updatePrice` permissionless |
| `fail-open` | `isEligible` returns true when unconfigured |
| `balance-unverified` | `liquidate` moves collateral without market verification |
| `oracle-risk` | TWAP with fallback staleness >3600 not handled |
| `gas-unbounded` | Loop over unbounded `marketAddresses` in `getPrice` |

## 6. Governance

- Multisig: 3-of-5 (founder + 2 security + 2 ecosystem). Address per chain in `deployment-manifests`.
- `setAuditGovernance(new)` only via multisig.

## 7. Disclaimer

Verification is time-bounded to the committed source. Upgrading adapter logic requires new address + re-verification.
