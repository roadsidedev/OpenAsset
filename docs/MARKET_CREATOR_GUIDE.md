# Market Creator Guide

## 1. Choosing Adapters

| Step | Question | If B20 (tokenized stock) | If generic ERC20 | If NFT |
|------|----------|--------------------------|------------------|--------|
| Asset | Custody | `B20AssetAdapter` | `ERC20Adapter` | `ERC721Adapter` |
| Oracle | Price | `ChainlinkEquityFeedAdapter` (90000s, sequencer 0xBCF8…6433) | `UniswapV3TWAPAdapter` (TWAP 10-30m) | `ChainlinkAdapter` or TWAP if pool exists |
| Compliance | Eligibility | `B20PolicyComplianceAdapter` (required) | None (permissionless) or `ERC3643` | None or `ERC3643` |
| Liquidation | How to sell | `DEXSwapLiquidationAdapter` (only valid for B20) | `DEXSwap` | `NFTAuction` |
| Position | Who holds | `SoulboundPositionAdapter` (compliance) | `Standard` (cheapest) | `Soulbound` or `Transferable` if you want sellable loans |

B20 auto-bundle: picking a B20 collateral in the wizard pre-selects `ChainlinkEquityFeed + B20Policy + Soulbound + DEXSwap`.

## 2. Risk Checklist

- [ ] LTV ≤75% for volatile assets (≤50% for meme). LTV 95% is max; high LTV leaves little liquidation buffer.
- [ ] APR sets borrower demand vs your yield. Show preview: `interest = principal * APR * duration / 365`.
- [ ] Duration + grace: `expiry = now + duration`, grace `24-168h` before liquidation on expiry.
- [ ] Health factor threshold 120% default; enable only if you want pre-expiry liquidations on price drop.
- [ ] Circuit breaker: `pause 20% / lookback 6h / resume 10% / cooldown 4h` is balanced. Widen for volatile.
- [ ] Oracle `maxStaleness`: TWAP `twapPeriod 600-1800`, equity `90000` (25h covers 24/5 + holiday). If NAV 24/7, set `enforceTradingWindow=false`.

## 3. Launch Checklist

- [ ] Collateral is a contract on this chain (wizard checks `getBytecode`).
- [ ] Lending asset is allowlisted (`isAllowedLendingAsset==true` — USDC on 84532/11155111).
- [ ] Adapters are `isSelectable` (verified or permissionless, not deprecated).
- [ ] `initialLiquidity` approved to factory; UI shows `creationFee 0.5%` + `netLiquidity`.
- [ ] Dry-run `simulateContract(createMarket)` passes.
- [ ] You have `lendingAsset` balance for approval + gas.

## 4. After Launch

- Monitor `MarketCard` (liquidity, APR, LTV, available) and `Market pulse` status.
- Manage via `depositLiquidity`/`withdrawLiquidity` (withdraw blocked if `reservedForSettling`).
- Pause via `market.pause()` if needed; `unpause()` when safe.
- Use paginated views `getMarketStatsPaginated(0,1000)` for large markets.

## 5. LTV 95% Cap Note

Spec §6 caps LTV at 95% (over-collateralized). Under-collateralized (≥100% LTV, e.g., 150%) is **not enabled** in 2.1. Future flag will require `complianceAdapter !=0` + verified oracle + capped TVL. Request via governance if needed.
