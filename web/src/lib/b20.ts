/**
 * @file b20.ts
 * @description B20 (Base tokenized stocks) frontend helpers
 * Verified against docs.base.org + IB20 spec at commit 5c6c5cd
 */

export const B20_POLICY_REGISTRY_BASE = "0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD";
export const BASE_SEQUENCER_FEED = "0xBCF85224fc0756B9Fa45aA7892530B47e10b6433";

export const B20_TOKENS: Record<string, { symbol: string; name: string; feed: string; address: string }> = {
  "0xb200000000000000000000c2e324d24d7eecd1fb": { symbol: "AAPLc", name: "Coinbase AAPL", feed: "0x787f13dEa48Db0897CbCDD985de77809D837F988", address: "0xb200000000000000000000C2e324d24d7eEcd1fb" },
  "0xb200000000000000000000d9192b6b456483c2e8": { symbol: "AMZNc", name: "Coinbase AMZN", feed: "0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295", address: "0xb200000000000000000000d9192b6B456483C2E8" },
  "0xb200000000000000000000c85a31389d71f3ecfb": { symbol: "COINc", name: "Coinbase COIN", feed: "0x408e44f504A7371a345F03a73dDC96A4b48e8aa7", address: "0xb200000000000000000000c85a31389D71F3ecfb" },
  "0xb20000000000000000000019f6e7c675b73c2e4d": { symbol: "CRCLc", name: "Coinbase CRCL", feed: "0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33", address: "0xB20000000000000000000019f6E7C675b73C2e4D" },
  "0xb2000000000000000000002d0ba3164cc74f58b7": { symbol: "GOOGLc", name: "Coinbase GOOGL", feed: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2", address: "0xb2000000000000000000002D0BA3164cc74f58B7" },
  "0xb2000000000000000000004aff16039ba04bdfbc": { symbol: "INTCc", name: "Coinbase INTC", feed: "0xAB657C39bac0D5886250D70849e2E3E008F2EECB", address: "0xB2000000000000000000004AFF16039bA04bdFBc" },
  "0xb2000000000000000000008bc8786b856e61707c": { symbol: "METAc", name: "Coinbase META", feed: "0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D", address: "0xb2000000000000000000008bC8786B856E61707C" },
  "0xb200000000000000000000ab99cfa739e253872b": { symbol: "MSFTc", name: "Coinbase MSFT", feed: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c", address: "0xb200000000000000000000Ab99cFa739E253872B" },
  "0xb2000000000000000000004884b426556b92883d": { symbol: "MSTRc", name: "Coinbase MSTR", feed: "0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a", address: "0xb2000000000000000000004884b426556b92883d" },
  "0xb20000000000000000000078ee7ce2fe4908108c": { symbol: "NVDAc", name: "Coinbase NVDA", feed: "0x04689a41629776563E6822F76f2e57D148d28513", address: "0xb20000000000000000000078ee7ce2fE4908108C" },
  "0xb200000000000000000000397293cb8cda9a10c5": { symbol: "SNDKc", name: "Coinbase SNDK", feed: "0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA", address: "0xb200000000000000000000397293Cb8cda9a10c5" },
  "0xb2000000000000000000007b9fcbd005511acbd5": { symbol: "SPCXc", name: "Coinbase SPCX", feed: "0x6A634B235903C4ad6376892180d6fF8612e3Fa68", address: "0xb2000000000000000000007b9fcbd005511aCBd5" },
  "0xb2000000000000000000001e800a7f5189430cd0": { symbol: "TSLAc", name: "Coinbase TSLA", feed: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4", address: "0xb2000000000000000000001e800a7f5189430cD0" },
};

export const B20_CHAIN_IDS = [8453] as const;
export const B20_MOCK_CHAIN_IDS = [84532] as const;

export function isB20Token(address: string | undefined, chainId: number | undefined): boolean {
  if (!address || chainId !== 8453) return false;
  return B20_TOKENS[address.toLowerCase()] !== undefined;
}

export function getB20Info(address: string | undefined, chainId: number | undefined) {
  if (!address || chainId !== 8453) return undefined;
  return B20_TOKENS[address.toLowerCase()];
}

export function isB20Market(collateralAsset: string | undefined, chainId: number | undefined): boolean {
  return isB20Token(collateralAsset, chainId);
}

// Trading window: Monday-Friday (UTC) — matches fixed ChainlinkEquityFeedAdapter (0=Sunday)
export function isWithinB20TradingWindow(date = new Date()): boolean {
  const day = date.getUTCDay(); // 0=Sunday
  if (day === 0 || day === 6) return false;
  return true;
}

export function b20MarketHoursLabel(date = new Date()): string {
  if (!isWithinB20TradingWindow(date)) return "Market closed — originations paused, repayments/liquidations open";
  return "Market open — 24/5 trusted pricing";
}

// Scaled balance helper for UI display (raw balance * multiplier / 1e18)
// Raw valuation is raw * feedPrice / 1e18; scaled display is raw * multiplier -> shares
export function toScaledDisplay(raw: bigint, multiplier: bigint): bigint {
  return (raw * multiplier) / 10n ** 18n;
}

// US geofence helper — coinbase.com/tokenize: US persons ineligible
// Frontend-only gate; not an enforcement layer but a UX guard
export function isUSJurisdiction(locale?: string, timezone?: string): boolean {
  // Heuristic: timezone contains America/* or locale en-US; real gate should use IP geo in production
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz && tz.startsWith("America/")) return true;
  if (locale && locale.toLowerCase().includes("-us")) return true;
  return false;
}

export const B20_RISK_DISCLOSURE = {
  title: "Tokenized equity risk",
  bullets: [
    "Issuer claim, not direct share custody — issuer insolvency = total loss possible (TR §12.1).",
    "Custody model: synthetic/offshore debt-security claim, not directly redeemable for underlying shares.",
    "Dividends accrue to the escrow contract (LendingMarketV2) while collateral is locked (B20 multiplier). Returned at repay — not streamed to wallet mid-loan.",
    "24/5 pricing — originations pause off-hours/weekends/corporate actions; liquidations use last-known-good price.",
    "DEX liquidation (default for B20) executes 24/7 against Base DEX liquidity; thin pools may partial-fill.",
    "Transfer restrictions via PolicyRegistry — sanctioned addresses blocked (isAuthorized).",
    "US persons ineligible per coinbase.com/tokenize.",
  ],
};

// B20 ABI fragments for scaled display (read-only)
export const B20_READ_ABI = [
  { type: 'function', name: 'scaledBalanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'multiplier', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'WAD_PRECISION', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'extraMetadata', inputs: [{ name: 'key', type: 'string' }], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
] as const;
