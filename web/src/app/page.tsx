import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Code,
  Cube,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

const PRINCIPLES = [
  {
    icon: Cube,
    eyebrow: "01 · Isolated by design",
    title: "One market. Its own risk.",
    copy: "Each market has its own liquidity, collateral, and rules. A failure in one market cannot drain another — isolation is what makes permissionless listing survivable.",
  },
  {
    icon: Sparkle,
    eyebrow: "02 · Adapters, not a rewrite",
    title: "New assets without touching the core.",
    copy: "Pricing, compliance, liquidation, custody, and positions are swappable modules. Coverage grows by writing an adapter — not by forking the protocol.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "03 · Trust before scale",
    title: "The engine does not blindly trust adapters.",
    copy: "Every adapter report is independently checked: balances received, price sanity, fail-closed compliance. A Verified mark is a review — not a solvency guarantee.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Choose the asset",
    copy: "Token, NFT, or tokenized real-world collateral — whatever has measurable value and an adapter that can represent it.",
  },
  {
    n: "02",
    title: "Pick the modules",
    copy: "Oracle, compliance, liquidation, and position adapters. See verification status before you commit.",
  },
  {
    n: "03",
    title: "Set the terms",
    copy: "LTV, rates, duration, and risk parameters you actually understand — not a listing committee’s compromise.",
  },
  {
    n: "04",
    title: "Deploy the market",
    copy: "Borrowers and liquidity providers discover it on its own. Your market never inherits someone else’s collateral risk.",
  },
];

const PATHS = [
  {
    icon: ArrowUpRight,
    label: "Market creators",
    title: "Launch a market for an asset you understand.",
    copy: "Set your own terms, keep the yield, and never inherit risk from someone else’s bad collateral choice.",
    href: "/create-market",
    action: "Create a market",
  },
  {
    icon: Code,
    label: "Developers",
    title: "Extend what can be borrowed against.",
    copy: "If you can write to a Solidity interface, you can add coverage — without permission, without waiting on our roadmap, without touching the core.",
    href: "/docs",
    action: "Read the adapter docs",
  },
  {
    icon: ArrowRight,
    label: "Borrowers & LPs",
    title: "Use a market with a thesis behind it.",
    copy: "Borrow against what you already hold, or provide liquidity to a market whose rules you can actually read.",
    href: "/markets",
    action: "Explore markets",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is OpenAsset just another lending protocol?",
    a: "No. Shared-pool protocols list a small set of assets and put every depositor in the same risk. OpenAsset is infrastructure for isolated markets: anyone can create one, and one market’s failure cannot drain the rest. We are not competing to be a better Aave.",
  },
  {
    q: "Do you support every asset today?",
    a: "The architecture supports almost any tokenized asset with measurable value — via an adapter, which may not exist yet. We do not chase categories without demand. “Almost any asset” is the honest line; “we support this” is reserved for adapters that are actually live.",
  },
  {
    q: "Isn’t permissionless extensibility a bigger attack surface?",
    a: "Isolation contains the blast radius. The core engine independently verifies adapter reports — balance deltas, price sanity bounds, fail-closed compliance — whether or not an adapter is Verified. Openness is survivable because markets do not share a pool.",
  },
  {
    q: "What is an adapter?",
    a: "A swappable module for one job: asset custody, pricing, compliance, liquidation, or position representation. New asset classes are added by writing an adapter, not by rewriting and re-auditing the core. A Verified mark means it passed review — not that OpenAsset underwrites the market.",
  },
  {
    q: "Is the protocol audited?",
    a: "Not yet. Until a named independent review is published, treat OpenAsset as designed for audit — not as already audited.",
  },
  {
    q: "Do you underwrite tokenized stocks or RWAs?",
    a: "No. If collateral is a tokenized real-world asset, issuer and counterparty risk sit with whoever chose that collateral. OpenAsset does not guarantee solvency off-chain. We disclose that boundary instead of hiding it.",
  },
  {
    q: "Is there a token or points program?",
    a: "No. There is no $OAM and no farming mechanic. Fees, when they apply, come from market activity — not from a points season.",
  },
  {
    q: "What can I borrow in?",
    a: "Markets lend in stablecoins today. That is a stated boundary, not an oversight.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function LandingPage() {
  return (
    <div className="landing-page min-h-dvh overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
      >
        Skip to content
      </a>

      <header className="landing-nav mx-4 mt-4 rounded-2xl border border-border/70 px-4 py-3 md:mx-8 md:mt-6 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-2" aria-label="OpenAsset home">
            <Image
              src="/openasset-logo-mark.png"
              alt=""
              width={32}
              height={32}
              className="brand-logo transition-transform duration-300 group-hover:rotate-[-4deg]"
              priority
            />
            <span className="font-serif text-lg tracking-tight text-foreground md:text-xl">OpenAsset</span>
          </Link>
          <nav className="hidden items-center gap-6 text-xs text-muted-foreground md:flex" aria-label="Landing page navigation">
            <a href="#problem" className="landing-nav-link">Why isolated</a>
            <a href="#how-it-works" className="landing-nav-link">How it works</a>
            <a href="#ecosystem" className="landing-nav-link">Who it&apos;s for</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
            <Link href="/docs" className="landing-nav-link">Docs</Link>
          </nav>
          <Link href="/create-market" className="landing-nav-cta">
            Create a market <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main id="landing-main">
        <section className="landing-hero mx-auto grid max-w-7xl items-center gap-10 px-5 pb-14 pt-12 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:px-12 md:pb-16 md:pt-14">
          <div className="max-w-2xl">
            <p className="eyebrow-label">Permissionless lending infrastructure</p>
            <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[0.94] tracking-[-0.055em] text-foreground md:text-7xl lg:text-[76px]">
              Create an isolated lending market for{" "}
              <span className="text-ice-500 dark:text-ice-300">almost any asset.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              Most protocols only list what governance allows — and pool everyone&apos;s risk together.
              OpenAsset does the opposite: you pick the collateral, the adapters, and the rules. No listing
              committee. No shared pool.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/create-market" className="editorial-primary-button group">
                Create a market
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link href="/markets" className="editorial-text-link text-sm">
                Explore markets
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
              {["Isolated markets", "Modular adapters", "No shared pool"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-400" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="landing-hero-art relative mx-auto flex aspect-square w-full max-w-[480px] items-center justify-center">
            <div className="landing-orbit landing-orbit-one" aria-hidden="true" />
            <div className="landing-orbit landing-orbit-two" aria-hidden="true" />
            <div className="landing-hero-mark-shell">
              <Image
                src="/openasset-logo-mark.png"
                alt="OpenAsset"
                width={260}
                height={260}
                className="brand-logo landing-hero-mark"
                priority
              />
            </div>
            <div className="landing-hero-note landing-hero-note-top">isolated · not pooled</div>
            <div className="landing-hero-note landing-hero-note-bottom">asset → market</div>
          </div>
        </section>

        <section id="problem" className="landing-ecosystem scroll-mt-16 border-y border-border/70">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[0.9fr_1.1fr] md:px-12 md:py-20">
            <div>
              <p className="eyebrow-label">The problem with shared pools</p>
              <h2 className="mt-4 font-serif text-3xl tracking-[-0.04em] text-foreground md:text-5xl">
                Listing is political. Failure is contagious.
              </h2>
            </div>
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              <p>
                If your asset is not on a small, governance-approved list, you cannot borrow against it.
                If it <em>is</em> listed in a shared pool, you inherit every other listing&apos;s risk.
              </p>
              <p>
                April 2026: after one collateral type failed, more than $6.6B exited a major shared pool
                in 48 hours. Isolation does not make an asset safer by slogan. It makes the failure
                smaller — because it cannot take the rest of the protocol with it.
              </p>
              <p className="text-foreground">
                OpenAsset lets the person who understands the asset create the market, and keeps that
                market&apos;s risk where it belongs.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-16 px-5 py-16 md:px-12 md:py-20">
          <div className="mb-8 max-w-2xl">
            <p className="eyebrow-label">How a market gets created</p>
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.04em] text-foreground md:text-5xl">
              Four steps. Then it is on its own.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              You do not wait for a listing vote. You configure a market, deploy it, and its risk stays inside it.
            </p>
          </div>
          <ol className="landing-steps">
            {STEPS.map((step) => (
              <li key={step.n} className="landing-step">
                <p className="eyebrow-label">{step.n}</p>
                <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight text-foreground">{step.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{step.copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-16 md:px-12 md:pb-20">
          <div className="mb-8 max-w-2xl">
            <p className="eyebrow-label">What the protocol actually does</p>
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.04em] text-foreground md:text-5xl">
              Built so openness does not require a shared pool.
            </h2>
          </div>
          <div className="landing-principles-rail" aria-label="OpenAsset design principles">
            <div className="landing-principles-track">
              <div className="landing-principles-set">
                {PRINCIPLES.map(({ icon: Icon, eyebrow, title, copy }) => (
                  <article key={eyebrow} className="landing-principle" role="listitem">
                    <Icon className="size-6 text-ice-500 dark:text-ice-300" />
                    <p className="eyebrow-label mt-8">{eyebrow}</p>
                    <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight text-foreground">{title}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{copy}</p>
                  </article>
                ))}
              </div>
              <div className="landing-principles-set" aria-hidden="true">
                {PRINCIPLES.map(({ icon: Icon, eyebrow, title, copy }) => (
                  <article key={`duplicate-${eyebrow}`} className="landing-principle">
                    <Icon className="size-6 text-ice-500 dark:text-ice-300" />
                    <p className="eyebrow-label mt-8">{eyebrow}</p>
                    <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight text-foreground">{title}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="ecosystem" className="landing-ecosystem scroll-mt-16 border-y border-border/70">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-12 md:py-20">
            <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="eyebrow-label">One protocol · three jobs</p>
                <h2 className="mt-4 font-serif text-3xl tracking-[-0.04em] text-foreground md:text-5xl">
                  Create. Extend. Use.
                </h2>
              </div>
              <Link href="/docs" className="landing-inline-link">
                Protocol docs <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {PATHS.map(({ icon: Icon, label, title, copy, href, action }) => (
                <Link key={label} href={href} className="landing-path group">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow-label">{label}</span>
                    <Icon className="size-4 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" />
                  </div>
                  <h3 className="mt-14 font-serif text-2xl leading-tight tracking-tight text-foreground">{title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{copy}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-foreground">
                    {action}
                    <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl scroll-mt-16 px-5 py-16 md:px-12 md:py-20">
          <div className="mb-8 max-w-2xl">
            <p className="eyebrow-label">Straight answers</p>
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.04em] text-foreground md:text-5xl">
              FAQ
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Technical judges and first-time creators ask the same questions. We answer them here instead of in a thread.
            </p>
          </div>
          <div className="landing-faq-list">
            {FAQS.map((item) => (
              <details key={item.q} className="landing-faq">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-16 md:px-12 md:pb-20">
          <div className="landing-final-cta rounded-[28px] border border-border/70 px-6 py-10 text-center md:px-12 md:py-14">
            <p className="eyebrow-label">No listing committee</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl leading-tight tracking-[-0.045em] text-foreground md:text-6xl">
              Launch a market without asking permission.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              Create an isolated lending market for an asset you understand — or read how adapters extend what the protocol can support.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/create-market" className="editorial-primary-button group">
                Create a market
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link href="/docs" className="editorial-text-link text-sm">
                Read the documentation
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 px-5 py-8 md:px-12">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-xs text-muted-foreground md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <Image src="/openasset-logo-mark.png" alt="" width={20} height={20} className="brand-logo" />
            <span className="font-semibold text-foreground">OpenAsset</span>
            <span>— isolated lending infrastructure</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/markets" className="landing-footer-link">Markets</Link>
            <Link href="/create-market" className="landing-footer-link">Create</Link>
            <Link href="/docs" className="landing-footer-link">Docs</Link>
            <Link href="/privacy" className="landing-footer-link">Privacy</Link>
            <Link href="/terms" className="landing-footer-link">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
