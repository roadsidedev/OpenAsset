# OpenAsset Market Fizz Properties

Generated for LendingMarketV2 core market.

## Global Properties

- [x] **GL-01** `property_availableLteTotal` — `availableLiquidity <= totalLiquidity` always holds. **Guarantee: SHOULD-HOLD**
- [x] **GL-02** `property_borrowedConsistent` — `totalBorrowed` is bounded by pool accounting. **Guarantee: SHOULD-HOLD**
- [x] **GL-03** `property_balanceCoversAvailable` — market token balance covers `availableLiquidity`. **Guarantee: SHOULD-HOLD**
- [x] **GL-04** `property_lpSupplyMatchesLiquidity` — LP supply is zero iff liquidity is zero. **Guarantee: SHOULD-HOLD**
- [x] **GL-05** `property_loanIdMonotone` — loan IDs only increase. **Guarantee: SHOULD-HOLD**

## Handlers (primary)

| Handler | Action |
|---|---|
| `lendingMarketV2_depositLiquidity_clamped` | LP deposits |
| `lendingMarketV2_withdrawLiquidity_clamped` | LP withdraws |
| `lendingMarketV2_requestLoan_clamped` | Borrower opens loan |
| `lendingMarketV2_repay_clamped` | Repay loan |
| `lendingMarketV2_liquidate_clamped` | Liquidate eligible loan |
| `lendingMarketV2_skipTime_clamped` | Advance time |
| `setCurrentActor` | Switch fuzz actor |
