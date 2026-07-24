# Fizz Campaign Report — OpenAsset Market

**Date:** 2026-07-24  
**Target:** LendingMarketV2 (+ adapters, factory)  
**Mode:** automatic  
**Fuzzer:** Medusa 1.5.1  

---

## Summary

| Metric | Value |
|---|---|
| Foundry smoke tests | **3/3 passed** |
| Medusa properties | **5/5 passed** |
| Medusa assertions | **27/27 passed** |
| Campaign calls | ~118k in ~90s |
| Branches hit | 2024 |
| Corpus size | 79 |
| Failures (final) | **0** |

---

## Suite layout

```
contracts/
├── test/fizz/
│   ├── Base.sol              # Deploys tokens, adapters, factory, market
│   ├── Properties.sol        # GL-01..GL-05 invariants
│   ├── Snapshots.sol
│   ├── FuzzTester.sol        # Medusa entry
│   ├── FoundryTester.sol     # forge test + repros
│   ├── handlers/
│   │   ├── Handlers.sol
│   │   └── LendingMarketV2Handler.sol
│   └── utils/                # MockERC20, MockOracle, Clamp, etc.
├── PROPERTIES.md
├── medusa.json
├── echidna.yaml
└── fizz_data/
    ├── report.md             # this file
    ├── contracts.json
    ├── corpus_medusa/
    └── logs_medusa/
```

---

## Properties (SHOULD-HOLD)

| ID | Name | Status |
|---|---|---|
| GL-01 | `availableLiquidity <= totalLiquidity` | PASSED |
| GL-02 | borrowed consistent with pool | PASSED |
| GL-03 | market balance covers availableLiquidity | PASSED (after fix) |
| GL-04 | LP supply ↔ liquidity coupling | PASSED |
| GL-05 | loanId monotone | PASSED |

---

## Bug found by Fizz (fixed)

### CRITICAL — Protocol fee skimmed principal on repay

**Contract:** `LendingMarketV2.repay`  
**Property broken:** GL-03 `property_balanceCoversAvailable`  
**Medusa sequence (shrunk):**
1. `requestLoan(7839)`
2. `repay(0)`

**Root cause:**  
```solidity
// BEFORE (buggy)
protocolShare = totalDebt * 10%   // 10% of principal+interest
availableLiquidity += principal   // full principal restored
// → available can exceed token balance
```

**Fix applied:**
```solidity
// AFTER
revenue = totalDebt - principal;           // interest (+ penalty only)
protocolShare = revenue * 10%;
availableLiquidity += principal + lpRevenue;
totalLiquidity += lpRevenue;
```

**Repro:** `forge test --match-test test_repro_property_balanceCoversAvailable -vv`

Matches V1 behavior (`LoanContract` already took 10% of **interest only**).

---

## How to re-run

```powershell
cd contracts
$env:FOUNDRY_PROFILE = "fuzz"
$env:Path = "C:\Users\USER\AppData\Local\Programs\Python\Python312;C:\Users\USER\AppData\Local\Programs\Python\Python312\Scripts;$env:USERPROFILE\.cargo\bin;" + $env:Path

# Smoke + repros
forge test --match-contract FoundryTester -vv

# Medusa campaign (90s example)
medusa fuzz --timeout 90

# Longer campaign
medusa fuzz --timeout 600
```

---

## Notes

- Suite focused on **V2 core market** (not V1 LoanContract clones / NFT paths).
- Circuit breaker disabled in harness setup for cleaner coverage.
- Oracle is `MockOracle` (constant trusted price).
- `crytic-compile` + `setuptools<81` required for Medusa on this machine.
- Uniswap V3 0.7.6 wrapper excluded from Foundry build (`_UniswapV3TWAPWrapper_sol`).
