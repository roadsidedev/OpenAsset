import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  Keyhole,
  Pulse,
  Scissors,
  SealCheck,
} from "@phosphor-icons/react/dist/ssr";
import "./landing.css";
import { GuillochePlate } from "@/components/landing/GuillochePlate";
import { GuillocheField } from "@/components/landing/GuillocheField";
import { AssemblyFlow } from "@/components/landing/AssemblyFlow";
import { Faq } from "@/components/landing/Faq";

export const metadata: Metadata = {
  title: "OpenAsset — Any asset. Its own market. Your terms.",
  description:
    "Permissionless, non-custodial lending infrastructure. Create an isolated lending market for almost any tokenized asset — tokens, NFTs, tokenized stocks, real-world assets — in one transaction.",
  openGraph: {
    title: "OpenAsset — Any asset. Its own market. Your terms.",
    description:
      "Create an isolated lending market for almost any tokenized asset. Non-custodial. One transaction. No approval process.",
    images: ["/openasset-logo.png"],
  },
};

const LEDGER_ROWS = [
  { key: "Assets listed", old: "~5% whitelisted blue-chips", novel: "Any asset with measurable value" },
  { key: "Terms", old: "Fixed by the protocol", novel: "Set by the market creator" },
  { key: "Listing", old: "Governance queue", novel: "One transaction" },
  { key: "Risk", old: "Shared pools", novel: "Isolated per market" },
];

const SPECIMENS = [
  {
    tag: "Tokenized stocks",
    title: "The breakout collateral, borrowable.",
    detail: "AAPLc on Base · Chainlink equity feed · compliance attached · DEX liquidation",
  },
  {
    tag: "NFT",
    title: "Liquidity without a fire-sale.",
    detail: "Auction liquidation · gradual seizure · 24–168h grace before expiry",
  },
  {
    tag: "Community token",
    title: "A market your DAO controls.",
    detail: "Creator-funded liquidity · creator-set terms · isolated risk",
  },
  {
    tag: "Long-tail ERC-20",
    title: "Listed by no committee.",
    detail: "TWAP-priced · permissionless · one transaction to live",
  },
];

const TRUST_ROWS = [
  {
    icon: CheckCircle,
    title: "Isolated by construction.",
    copy: "Every market is its own contract. No shared pool, no contagion path — a failure in one market cannot reach another.",
  },
  {
    icon: Pulse,
    title: "Priced against manipulation.",
    copy: "Time-weighted average prices over minutes, not blocks. Circuit breakers pause new loans during extreme volatility while repayments and liquidations continue.",
  },
  {
    icon: Scissors,
    title: "Liquidation without cruelty.",
    copy: "Gradual liquidation seizes only what covers the debt plus a penalty — never the whole position.",
  },
  {
    icon: SealCheck,
    title: "Bounded promises.",
    copy: "The core specification is independently audited and frozen at v2.1; changes require a version bump and re-audit. Adapter verification is a review signal, not a guarantee — unverified adapters are labeled, and using one requires an explicit acknowledgment.",
  },
  {
    icon: Keyhole,
    title: "Non-custodial.",
    copy: "Your keys, your collateral, your market. The frontend is a view layer, not a security boundary.",
  },
];

const DIRECTION_CONTRACT = `DIRECTION CONTRACT — OpenAsset landing (seed da303c2a, user-pinned fusion):
THESIS: the engraved certificate — the most considered surface in finance — carries OpenAsset's promise; the creation flow is a machine assembling inside it. Refuses the dark-neon DeFi template and the plain-SaaS opposite.
OWN-WORLD: warm paper #F6F3EC, engraved ink #14251D, hairline rules, engraved-blue #1D82D1, guilloché plates, Instrument Serif display, Geist UI, mono only for measurement.
STORY: visitor reads the 95% problem, watches a market assemble from adapters, reads the trust legend, leaves asking "what market can I create?"
FIRST VIEWPORT: certificate cartouche on paper, guilloché field behind, headline "Any asset. Its own market. Your terms.", primary action "Create a market", mini certificate-face specimen lower right, fee/trust microline on a hairline.
FORM: fusion of the Stock Certificate world and the Machine assembly; seed key da303c2a; user-pinned fusion beats the roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.`;

export default function LandingPage() {
  return (
    <div className="cert-page min-h-dvh overflow-x-clip">
      {/* Direction contract — survives the build; grep for "DIRECTION CONTRACT" in .next output */}
      <div
        style={{ display: "none" }}
        dangerouslySetInnerHTML={{
          __html: `<!-- ${DIRECTION_CONTRACT.replace(/--/g, "—")} -->`,
        }}
      />
      <a
        href="#cert-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--oa-ink)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--oa-paper)]"
      >
        Skip to content
      </a>

      {/* ============================== NAV ============================== */}
      <header className="cert-nav">
        <div className="mx-auto flex h-14 max-w-[1160px] items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="OpenAsset home">
            <Image src="/openasset-logo-mark.png" alt="" width={30} height={30} className="brand-logo" priority />
            <span className="font-display text-lg tracking-[-0.025em] text-[var(--oa-ink)]">OpenAsset</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Landing navigation">
            <a href="#how-it-works" className="cert-nav-link">How it works</a>
            <a href="#adapters" className="cert-nav-link">Adapters</a>
            <a href="#faq" className="cert-nav-link">FAQ</a>
            <Link href="/docs" className="cert-nav-link">Docs</Link>
          </nav>
          <Link href="/markets" className="cert-button-ghost px-4! py-2! text-[13px]!">
            Open app <ArrowUpRight className="size-3.5" weight="bold" />
          </Link>
        </div>
      </header>

      <main id="cert-main">
        {/* ============================ HERO ============================ */}
        <section className="cert-section relative">
          <GuillochePlate className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.5]" />
          <GuillocheField className="pointer-events-none absolute inset-0 h-full w-full" bands={6} />
          <div className="relative mx-auto grid max-w-[1160px] items-end gap-10 px-4 pb-16 pt-14 md:min-h-[calc(100dvh-56px)] md:grid-cols-[1.15fr_0.85fr] md:gap-12 md:px-6 md:pb-20 md:pt-20">
            <div className="relative">
              <h1 className="cert-display mt-0 text-[clamp(2.9rem,6.2vw,5.5rem)] leading-[0.98] tracking-[-0.045em]">
                Any asset.
                <br />
                Its own market.
                <br />
                Your terms.
              </h1>
              <p className="cert-body mt-7 text-lg leading-relaxed md:text-xl">
                OpenAsset lets anyone create an isolated lending market for almost
                any asset with measurable value — tokens, NFTs, tokenized stocks,
                real-world assets — non-custodial, in one transaction, with no
                approval process.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link href="/create-market" className="cert-button group">
                  Create a market
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" weight="bold" />
                </Link>
                <Link href="/markets" className="cert-button-ghost">
                  Explore live markets
                </Link>
              </div>
              <div className="mt-10 border-t border-[var(--oa-rule)] pt-4">
                <p className="cert-micro tracking-[0.1em]!">
                  0.5% creation fee · 0.5% origination · non-custodial · audited core v2.1 · isolated markets
                </p>
              </div>
            </div>

            {/* Mini certificate-face specimen — the hero's proof */}
            <div className="relative mx-auto w-full max-w-[400px] md:justify-self-end">
              <div className="cert-frame bg-[var(--oa-paper-card)] p-5 shadow-[0_30px_70px_-40px_rgba(20,37,29,0.5)]">
                <span className="cert-frame-corner tl" />
                <span className="cert-frame-corner tr" />
                <span className="cert-frame-corner bl" />
                <span className="cert-frame-corner br" />
                <div className="flex items-baseline justify-between border-b border-[var(--oa-rule)] pb-3">
                  <span className="cert-cap">Market certificate</span>
                  <span className="cert-hallmark">Verified</span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="font-display text-4xl tracking-[-0.03em] text-[var(--oa-ink)]">NVDAc</p>
                    <p className="mt-1 text-[13px] text-[var(--oa-ink-soft)]">Tokenized stock · Base</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-4xl tabular-nums tracking-[-0.03em] text-[var(--oa-ink)]">65<span className="text-2xl">%</span></p>
                    <p className="mt-1 text-[13px] text-[var(--oa-ink-soft)]">max LTV</p>
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-[var(--oa-rule)] pt-4 text-[13px]">
                  <div className="contents">
                    <dt className="text-[var(--oa-ink-faint)]">Borrow APR</dt>
                    <dd className="text-right tabular-nums text-[var(--oa-ink)]">12.0%</dd>
                    <dt className="text-[var(--oa-ink-faint)]">Price feed</dt>
                    <dd className="text-right text-[var(--oa-ink)]">Chainlink</dd>
                    <dt className="text-[var(--oa-ink-faint)]">Liquidation</dt>
                    <dd className="text-right text-[var(--oa-ink)]">DEX swap</dd>
                    <dt className="text-[var(--oa-ink-faint)]">Isolation</dt>
                    <dd className="text-right text-[var(--oa-ink)]">Per market</dd>
                  </div>
                </dl>
              </div>
              <p className="cert-cap mt-3 text-center">
                Specimen — a live market&apos;s face
              </p>
            </div>
          </div>
        </section>

        {/* ======================= THE PROBLEM ======================= */}
        <section className="cert-section mx-auto max-w-[1160px] px-4 py-20 md:px-6 md:py-28">
          <div className="max-w-2xl">
            <h2 className="cert-display text-[clamp(2rem,3.8vw,3.25rem)] leading-[1.02] tracking-[-0.04em]">
              The 95% problem.
            </h2>
            <p className="cert-body mt-5">
              Legacy lending platforms whitelist a handful of assets and control
              every term. Governance queues decide what gets a market. The result:
              the overwhelming majority of on-chain value — gaming assets,
              community tokens, niche collections, tokenized stocks — has no
              lending utility at all. OpenAsset is a factory, not a gatekeeper.
            </p>
          </div>

          <div className="mt-12 border-b border-[var(--oa-rule)] md:mt-16">
            <div className="cert-ledger-row border-t-0!">
              <span className="cert-ledger-head" aria-hidden="true" />
              <span className="cert-ledger-head">The whitelist</span>
              <span className="cert-ledger-head" style={{ color: "var(--oa-accent-ink)" }}>The factory</span>
            </div>
            {LEDGER_ROWS.map((row) => (
              <div key={row.key} className="cert-ledger-row">
                <span className="cert-ledger-key">{row.key}</span>
                <span className="cert-ledger-old">{row.old}</span>
                <span className="cert-ledger-new">{row.novel}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ======================= HOW IT WORKS ======================= */}
        <section id="how-it-works" className="cert-section scroll-mt-14 border-t border-[var(--oa-rule)]">
          <div className="mx-auto max-w-[1160px] px-4 pt-20 md:px-6 md:pt-28">
            <div className="max-w-2xl">
              <h2 className="cert-display text-[clamp(2rem,3.8vw,3.25rem)] leading-[1.02] tracking-[-0.04em]">
                From asset to market in one transaction.
              </h2>
              <p className="cert-body mt-5">
                Scroll to assemble one. Every part below is a real adapter choice
                the wizard makes with you — the machine is the flow.
              </p>
            </div>
          </div>
          <AssemblyFlow />
        </section>

        {/* ======================== ADAPTERS ========================= */}
        <section id="adapters" className="cert-section scroll-mt-14 border-t border-[var(--oa-rule)]">
          <div className="mx-auto max-w-[1160px] px-4 py-20 md:px-6 md:py-28">
            <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:gap-16">
              <div>
                <h2 className="cert-display text-[clamp(2rem,3.8vw,3.25rem)] leading-[1.02] tracking-[-0.04em]">
                  &ldquo;Any asset&rdquo; is a promise we can keep.
                </h2>
                <p className="cert-body mt-5">
                  OpenAsset separates one stable, narrowly-scoped lending engine
                  from a pluggable adapter layer — custody, pricing, eligibility,
                  liquidation, position. The engine is audited and frozen. A new
                  asset class doesn&apos;t require re-auditing the protocol. It
                  requires an adapter.
                </p>
                <p className="cert-body mt-4">
                  Every adapter shows its verification status and the value it
                  secures. Every new adapter makes every next market easier.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href="/docs" className="cert-button group">
                    Build an adapter
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" weight="bold" />
                  </Link>
                  <Link href="/docs" className="cert-textlink">Read the adapter spec</Link>
                </div>
              </div>

              <div className="border-b border-[var(--oa-rule)]">
                <div className="cert-sheet-row border-t-0!">
                  <span className="cert-ledger-head">Layer</span>
                  <span className="cert-ledger-head">What it carries</span>
                  <span className="cert-ledger-head text-right">Status</span>
                </div>
                {[
                  { layer: "Lending engine", carry: "Isolated markets, accounting, validation — narrowly scoped, audited, frozen at v2.1", status: "Audited" },
                  { layer: "Asset adapters", carry: "Custody for ERC-20, ERC-721/1155, tokenized stocks, RWA", status: "Verified" },
                  { layer: "Oracle adapters", carry: "Uniswap V3 TWAP · Chainlink equity feeds with staleness windows", status: "Verified" },
                  { layer: "Compliance adapters", carry: "ERC-3643 eligibility, issuer allowlists, jurisdiction rules", status: "Optional" },
                  { layer: "Liquidation adapters", carry: "DEX swap · NFT auction · issuer redemption", status: "Verified" },
                  { layer: "Custom adapters", carry: "Register your own — labeled, and never mistaken for audited", status: "Unverified" },
                ].map((row) => (
                  <div key={row.layer} className="cert-sheet-row">
                    <span className="cert-cap-strong">{row.layer}</span>
                    <span className="text-[13.5px] leading-relaxed text-[var(--oa-ink-soft)]">{row.carry}</span>
                    <span className="justify-self-start md:justify-self-end">
                      <span className={`cert-hallmark ${row.status === "Unverified" ? "cert-hallmark-unverified" : ""}`}>
                        {row.status}
                      </span>
                    </span>
                  </div>
                ))}
                <p className="cert-fine mt-5">
                  Verification is a review signal — not insurance. Unverified use requires explicit acknowledgment.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== WHAT MARKETS EXIST ==================== */}
        <section className="cert-section border-t border-[var(--oa-rule)]">
          <div className="mx-auto max-w-[1160px] px-4 py-20 md:px-6 md:py-28">
            <div className="max-w-2xl">
              <h2 className="cert-display text-[clamp(2rem,3.8vw,3.25rem)] leading-[1.02] tracking-[-0.04em]">
                What market can you create?
              </h2>
              <p className="cert-body mt-5">
                Tokenized stocks — this cycle&apos;s breakout asset class,
                memestocks included — become borrowable collateral the moment
                someone sets the terms. The question isn&apos;t whether the
                protocol supports your asset. It&apos;s what terms you&apos;d set.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-12">
              <div className="md:col-span-7">
                <SpecimenCard specimen={SPECIMENS[0]} />
              </div>
              <div className="md:col-span-5">
                <SpecimenCard specimen={SPECIMENS[1]} />
              </div>
              <div className="md:col-span-5">
                <SpecimenCard specimen={SPECIMENS[2]} />
              </div>
              <div className="md:col-span-7">
                <SpecimenCard specimen={SPECIMENS[3]} />
              </div>
            </div>
          </div>
        </section>

        {/* ========================= TRUST ========================== */}
        <section className="cert-section border-t border-[var(--oa-rule)]">
          <div className="mx-auto max-w-[1160px] px-4 py-20 md:px-6 md:py-28">
            <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
              <div>
                <h2 className="cert-display text-[clamp(2rem,3.8vw,3.25rem)] leading-[1.02] tracking-[-0.04em]">
                  Built like the risk is real.
                </h2>
                <p className="cert-body mt-5">
                  Because it is. A lending protocol carries direct financial
                  risk; security and operational discipline are the growth
                  infrastructure. Read the features the way you would read the
                  security legend on a note.
                </p>
              </div>
              <div className="border-b border-[var(--oa-rule)]">
                {TRUST_ROWS.map(({ icon: Icon, title, copy }) => (
                  <div key={title} className="cert-trust-row">
                    <span className="cert-trust-icon">
                      <Icon className="size-5" weight="regular" />
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold text-[var(--oa-ink)]">{title}</p>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--oa-ink-soft)]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ========================== FAQ =========================== */}
        <section id="faq" className="cert-section scroll-mt-14 border-t border-[var(--oa-rule)]">
          <div className="mx-auto max-w-[1160px] px-4 py-20 md:px-6 md:py-28">
            <div className="grid gap-12 md:grid-cols-[0.75fr_1.25fr] md:gap-16">
              <div>
                <h2 className="cert-display text-[clamp(2rem,3.8vw,3.25rem)] leading-[1.02] tracking-[-0.04em]">
                  The questions that matter.
                </h2>
                <p className="cert-body mt-5">
                  What everyone should know before the first market — stated
                  plainly, including the limits.
                </p>
              </div>
              <div className="border-b border-[var(--oa-rule)]">
                <Faq />
              </div>
            </div>
          </div>
        </section>

        {/* ======================== FINAL CTA ======================== */}
        <section className="cert-section relative border-t border-[var(--oa-rule)]">
          <GuillochePlate className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.55]" />
          <GuillocheField className="pointer-events-none absolute inset-0 h-full w-full" bands={4} />
          <div className="relative mx-auto max-w-[1160px] px-4 py-24 text-center md:px-6 md:py-32">
            <h2 className="cert-display mx-auto max-w-3xl text-[clamp(2.4rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.045em]">
              What market can I create?
            </h2>
            <p className="cert-body mx-auto mt-6 text-center">
              That&apos;s the only question OpenAsset leaves you. Pick an asset,
              set the terms, and deploy in one transaction — or build the adapter
              that puts a new asset class on the board.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/create-market" className="cert-button group">
                Create a market
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" weight="bold" />
              </Link>
              <Link href="/markets" className="cert-button-ghost">
                Enter the app
              </Link>
              <Link href="/docs" className="cert-textlink">Build an adapter</Link>
            </div>
          </div>
        </section>
      </main>

      {/* ========================= FOOTER ========================= */}
      <footer className="border-t border-[var(--oa-rule)] px-4 py-10 md:px-6">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-2">
            <Image src="/openasset-logo-mark.png" alt="" width={20} height={20} className="brand-logo" />
            <span className="font-semibold text-[var(--oa-ink)]">OpenAsset</span>
            <span className="text-[13px] text-[var(--oa-ink-soft)]">— open infrastructure for asset lending</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
            <Link href="/markets" className="cert-footer-link">Markets</Link>
            <Link href="/portfolio" className="cert-footer-link">Positions</Link>
            <Link href="/account" className="cert-footer-link">Account</Link>
            <Link href="/docs" className="cert-footer-link">Docs</Link>
            <Link href="/privacy" className="cert-footer-link">Privacy</Link>
            <Link href="/terms" className="cert-footer-link">Terms</Link>
          </nav>
        </div>
        <div className="mx-auto mt-8 max-w-[1160px] border-t border-[var(--oa-rule)] pt-5">
          <p className="cert-fine">
            Non-custodial open infrastructure · fees enforced on-chain · digital assets involve risk · nothing here is financial advice
          </p>
        </div>
      </footer>
    </div>
  );
}

function SpecimenCard({ specimen }: { specimen: (typeof SPECIMENS)[number] }) {
  return (
    <div className="cert-specimen h-full">
      <span className="cert-frame-corner tl" />
      <span className="cert-frame-corner tr" />
      <span className="cert-frame-corner bl" />
      <span className="cert-frame-corner br" />
      <span className="cert-specimen-tag">{specimen.tag}</span>
      <p className="cert-display mt-5 text-[clamp(1.35rem,2vw,1.7rem)] leading-[1.15] tracking-[-0.03em]">
        {specimen.title}
      </p>
      <p className="cert-specimen-detail mt-4">{specimen.detail}</p>
    </div>
  );
}
