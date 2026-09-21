/**
 * Faq: the prospectus. Questions everyone should know about OpenAsset,
 * answered plainly. Native details/summary: works without JavaScript,
 * fully keyboard accessible, custom engraved minus/plus mark in CSS.
 */

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "What is OpenAsset?",
    a: "Permissionless, non-custodial lending infrastructure. Anyone can launch an isolated lending market for almost any tokenized asset with measurable value, in one transaction, with no approval process.",
  },
  {
    q: "I hold a tokenized stock / NFT / long-tail token. What can I actually do here?",
    a: "Find a market that accepts your asset, or create one, then borrow against it without selling. You keep the position and its upside. Loan terms are set by whoever created that market, and shown before you sign.",
  },
  {
    q: "How is this different from Aave or Compound?",
    a: "They whitelist assets and fix the terms; OpenAsset is a factory, you pick the asset and set the LTV, rate, duration, and liquidation rules. Most onchain assets have no lending market at all. This is where they get one.",
  },
  {
    q: "What can be used as collateral?",
    a: "ERC-20 tokens, ERC-721 and ERC-1155 NFTs, tokenized stocks, and real-world assets, wherever the required infrastructure and compliance conditions exist. Pricing comes from TWAP or Chainlink-feed adapters.",
  },
  {
    q: "Who sets the market terms?",
    a: "The market creator. LTV (capped at 95%), APR, duration, grace period, health-factor threshold, circuit-breaker thresholds. The protocol enforces exactly what you declare, nothing more.",
  },
  {
    q: "What does \"isolated market\" actually protect me from?",
    a: "Everything stays inside the market. No shared pool, no cross-market contagion. One market's bad debt can never touch another market's liquidity.",
  },
  {
    q: "How are prices handled?",
    a: "Uniswap V3 time-weighted average prices for crypto-native tokens, resistant to flash-loan manipulation, and Chainlink equity feeds with staleness windows for tokenized stocks. Circuit breakers pause new borrowing during extreme volatility while repayments and liquidations continue.",
  },
  {
    q: "What happens in a liquidation?",
    a: "Gradual liquidation: the protocol seizes only the collateral needed to cover the debt plus a penalty, never the whole position. NFT markets liquidate by auction; tokenized stocks can settle through issuer redemption. Grace periods of 24 to 168 hours apply before expiry liquidations.",
  },
  {
    q: "Does \"Verified\" mean an adapter is safe?",
    a: "No. Verified means the audit-governance multisig reviewed the adapter's source, tests, and dependencies and attests it implements its interface correctly and fails closed. It is a bounded review signal, not insurance. Unverified adapters are clearly labeled and require an explicit acknowledgment before use.",
  },
  {
    q: "Is the protocol audited?",
    a: "The core lending engine is deliberately narrow, specifically so it can be reviewed thoroughly and then left alone. Its specification is frozen at v2.1, and any change requires a version bump and fresh review. Current audit status and reports are published in the docs.",
  },
  {
    q: "What does it cost?",
    a: "0.5% of initial liquidity when a market is created, and a 0.5% origination fee on each loan. Both are enforced on-chain and shown before you sign. No hidden spreads.",
  },
  {
    q: "Can I create an under-collateralized market (100%+ LTV)?",
    a: "Not today. The current specification caps LTV at 95%, so every market is over-collateralized. A future flag would require a compliance adapter, a verified oracle, and a capped TVL before under-collateralized lending can exist.",
  },
  {
    q: "Which chains are supported?",
    a: "OpenAsset is EVM-first, launching where tokenized assets are already trading, including Base and Robinhood Chain. Because markets are deployed per chain from the same core, adding a chain is a deployment, not a rebuild. The app shows every chain currently live.",
  },
  {
    q: "Is there a token?",
    a: "No. There is no OpenAsset token, and market creation needs no governance vote. That's the point.",
  },
];

export function Faq() {
  return (
    <div>
      {FAQS.map((item) => (
        <details key={item.q} className="cert-faq">
          <summary>
            <span className="cert-faq-q">{item.q}</span>
            <span className="cert-faq-mark" aria-hidden="true" />
          </summary>
          <p className="cert-faq-a">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
