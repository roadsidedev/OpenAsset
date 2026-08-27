# Base Mainnet 8453 Deployment Manifest — v1.0 Approved

**Approved by:** user (phase 1 manifest approved 2026-08-27)
**Chain ID:** 8453
**Lending asset:** USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` — 6 decimals, code verified via BaseScan
**Sequencer:** `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` — Chainlink L2 Sequencer Uptime Feed for Base (docs.chain.link/data-feeds/l2-sequencer-feeds)
**Router:** `0x2626664c2603336E57B271c5a0b1b84Dede46080` — Uniswap SwapRouter02 on Base (official Uniswap deployments)
**B20 policy registry:** `0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD`
**B20 collateral tokens (13):** AAPLc, AMZNc, COINc, CRCLc, GOOGLc, INTCc, METAc, MSFTc, MSTRc, NVDAc, SNDKc, SPCXc, TSLAc — see `contracts/scripts/deployV2.ts:B20_TOKENS_BASE` — 8 decimals, precompile addresses `0xB200...`
**B20 feeds (13):** `0x787f13...` (AAPLc) etc — see `B20_FEEDS_BASE` — 8 decimals, `latestRoundData()` positive, `description()` TRV proxy, verified on BaseScan
**Compliance:** B20PolicyComplianceAdapter + external KYC/KYB/sanctions/jurisdiction (off-chain allowlist admin via B20 policy)
**Interest model:** pending fix (see Phase 4 blocker)
**Provider:** `OPENASSET_PROVIDER_B20` = `keccak256("OPENASSET_PROVIDER_B20")` = `0x7e92cb...`
**Provenance:** https://www.base.org/stocks + https://docs.chain.link/data-feeds/price-feeds/addresses + Uniswap docs
**Verification timestamp:** 2026-08-27T00:00:00Z (re-verify code/decimals/answer at deploy time)
**Pool fee selection:** per-token Uniswap V3 pool, quote simulation required after deployment (500/3000/10000 candidate for Base USDC pairs)
**Approver:** user — approved manifest preparation; lending asset stablecoin-agnostic
