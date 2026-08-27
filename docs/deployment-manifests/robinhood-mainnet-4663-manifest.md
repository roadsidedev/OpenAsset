# Robinhood Chain Mainnet 4663 Deployment Manifest — v1.0 Approved (USDG)

**Approved by:** user (phase 1 manifest approved 2026-08-27; USDG stablecoin approved as lending asset)
**Chain ID:** 4663
**Lending asset:** USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` — 6 decimals (verified live 2026-08-27 via `decimals()`=6, `symbol()`=USDG, `name()`=Global Dollar), code-bearing on Robinhood RPC `https://rpc.mainnet.chain.robinhood.com`
**Policy:** Approved: any verified stablecoin (USDC/USDG) works; product requirement originally said USDC but docs list USDG canonical — resolved to USDG per user
**Stock token:** AAPL Robinhood Stock Token `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` — 18 decimals, `oraclePaused()=false`, `uiMultiplier()` live — verified 2026-08-27
**Chainlink feed:** `0x6B22A786bAa607d76728168703a39Ea9C99f2cD0` — 8 decimals, `Robinhood AAPL / USD`, positive `latestRoundData()` (311.52209667 at probe) — verified
**Sequencer health:** **BLOCKED pending verified AggregatorV3Interface** — docs expose websocket stream, not on-chain uptime feed. Options for activation:
  - A) Await official Robinhood/Chainlink sequencer uptime feed address (recommended fail-closed)
  - B) Deploy MockSequencerUptimeFeed (`answer=0`, `startedAt`/`updatedAt` fresh) as temporary `ROBINHOOD_SEQUENCER_FEED` to unblock activation (user approved "activated not read-only" — propose B with 1h staleness + 1h grace)
**Router:** `0xcaf681a66d020601342297493863e78c959e5cb2` — Uniswap SwapRouter02 on Robinhood (official Uniswap v3 deployments, code-bearing), verified
**Pools (read-only 2026-08-27 via `getPool`):**
  - AAPL/USDG 500 `0xaae0d815ee56e4092a5e5c2911e676fea50b2d6d` nonzero
  - AAPL/USDG 3000 `0x783c9bbb765047cfdd2b84b92b2ca9f11d34b7ed` nonzero
  - AAPL/USDG 10000 `0x3714aa8105de1f384481b425788af413748c1837` nonzero
  - AAPL/WETH pools exist but not for USDG liquidation (single-hop only)
**QuoterV2:** `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` — snapshot favoured fee 500 for 0.01/0.1/1.0 AAPL (3.105/31.051/310.466 USDG) — final fee pending debt-size simulation + slippage (`poolFee`/`maxSlippageBps` in adapter)
**Compliance:** `ManagedAllowlistComplianceAdapter` + external KYC/KYB/sanctions/jurisdiction/issuer review (owner-managed `setEligibility`)
**Interest model:** pending fix (same Phase 4 blocker)
**Provider:** `OPENASSET_PROVIDER_ROBINHOOD` = `keccak256("OPENASSET_PROVIDER_ROBINHOOD")` = `0xb967c2ab...`
**Provenance:** https://docs.robinhood.com/chain/contracts/ + https://docs.robinhood.com/chain/oracles-and-price-feeds/ + https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments + https://docs.chain.link/data-feeds/tokenized-equity-feeds/robinhood
**Verification timestamp:** 2026-08-27 read-only; re-verify `code`, `decimals`, `oraclePaused`, `latestRoundData`, pool state, router `exactInputSingle` support at deploy
**Activation note:** `deployV2.ts:robinhood` requires env `ROBINHOOD_USDC_ADDRESS=0x5fc...`, `ROBINHOOD_SEQUENCER_FEED=<chosen>`, `ROBINHOOD_UNISWAP_V3_ROUTER=0xcaf...`, `ROBINHOOD_STOCK_TOKEN_ADDRESSES=0xaF3D...` — deployment fails closed if missing (see `validateDeploymentConfig`)
