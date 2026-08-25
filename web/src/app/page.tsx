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

const PLATFORM_PRINCIPLES = [
  {
    icon: Cube,
    eyebrow: "01 · Isolated by design",
    title: "One asset, one market, clear rules.",
    copy: "Create focused lending markets where collateral, terms, liquidity, and risk parameters stay understandable.",
  },
  {
    icon: Sparkle,
    eyebrow: "02 · Modular by default",
    title: "Use the adapter that fits.",
    copy: "Pricing, liquidation, compliance, and asset-specific logic can evolve without changing the core protocol.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "03 · Trust before scale",
    title: "Make risk visible before activity grows.",
    copy: "Market configuration and adapter status give participants the context they need to make informed decisions.",
  },
];

const ECOSYSTEM_PATHS = [
  {
    icon: ArrowUpRight,
    label: "Market creators",
    title: "Turn an asset thesis into a live market.",
    copy: "Set the terms, choose the modules, and give borrowers and liquidity providers a place to participate.",
    href: "/create-market",
    action: "Create a market",
  },
  {
    icon: Code,
    label: "Developers",
    title: "Build the modules that unlock new markets.",
    copy: "Adapters make pricing, liquidation, and compliance extensible across more asset categories.",
    href: "/docs",
    action: "Read the docs",
  },
  {
    icon: ArrowRight,
    label: "Liquidity providers",
    title: "Discover markets with a thesis behind them.",
    copy: "Browse market terms and available liquidity before deciding where your capital belongs.",
    href: "/markets",
    action: "Explore markets",
  },
];

export default function LandingPage() {
  return (
    <div className="landing-page min-h-dvh overflow-x-clip">
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
      >
        Skip to content
      </a>

      <header className="landing-nav mx-4 mt-4 rounded-2xl border border-border/70 px-4 py-3 md:mx-8 md:mt-6 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-2" aria-label="OpenAsset home">
            <Image src="/openasset-logo-mark.png" alt="" width={32} height={32} className="brand-logo transition-transform duration-300 group-hover:rotate-[-4deg]" priority />
            <span className="font-serif text-lg tracking-tight text-foreground md:text-xl">OpenAsset</span>
          </Link>
          <nav className="hidden items-center gap-6 text-xs text-muted-foreground md:flex" aria-label="Landing page navigation">
            <a href="#how-it-works" className="landing-nav-link">How it works</a>
            <a href="#ecosystem" className="landing-nav-link">For the ecosystem</a>
            <Link href="/docs" className="landing-nav-link">Docs</Link>
          </nav>
          <Link href="/markets" className="landing-nav-cta">
            Open app <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main id="landing-main">
        <section className="landing-hero mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-20 md:grid-cols-[1.05fr_0.95fr] md:px-12 md:pb-28 md:pt-28">
          <div className="max-w-2xl">
            <p className="eyebrow-label">Permissionless asset lending infrastructure</p>
            <h1 className="mt-6 max-w-3xl font-serif text-5xl leading-[0.94] tracking-[-0.055em] text-foreground md:text-7xl lg:text-[88px]">
              Create markets for <span className="text-ice-500 dark:text-ice-300">what matters.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              OpenAsset gives market creators the infrastructure to launch isolated lending markets for assets with measurable value.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/markets" className="editorial-primary-button group">
                Explore live markets <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link href="/create-market" className="editorial-text-link text-sm">
                Create a market
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
              {["Isolated markets", "Modular adapters", "Configurable risk"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-400" /> {item}
                </span>
              ))}
            </div>
          </div>

          <div className="landing-hero-art relative mx-auto flex aspect-square w-full max-w-[520px] items-center justify-center">
            <div className="landing-orbit landing-orbit-one" aria-hidden="true" />
            <div className="landing-orbit landing-orbit-two" aria-hidden="true" />
            <div className="landing-hero-mark-shell">
              <Image src="/openasset-logo-mark.png" alt="OpenAsset" width={260} height={260} className="brand-logo landing-hero-mark" priority />
            </div>
            <div className="landing-hero-note landing-hero-note-top">asset → market</div>
            <div className="landing-hero-note landing-hero-note-bottom">open infrastructure</div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-16 px-5 pb-24 md:px-12 md:pb-32">
          <div className="mb-10 max-w-2xl">
            <p className="eyebrow-label">A protocol for market creation</p>
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.04em] text-foreground md:text-5xl">From asset thesis to open market.</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">OpenAsset keeps the path legible: define the market, choose the modules, and make the terms discoverable.</p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[28px] border border-border/70 bg-border/60 md:grid-cols-3">
            {PLATFORM_PRINCIPLES.map(({ icon: Icon, eyebrow, title, copy }) => (
              <article key={eyebrow} className="landing-principle bg-card/80 p-6 md:p-8">
                <Icon className="size-6 text-ice-500 dark:text-ice-300" />
                <p className="eyebrow-label mt-10">{eyebrow}</p>
                <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight text-foreground">{title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="ecosystem" className="landing-ecosystem border-y border-border/70 scroll-mt-16">
          <div className="mx-auto max-w-7xl px-5 py-24 md:px-12 md:py-32">
            <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="eyebrow-label">One protocol · many participants</p>
                <h2 className="mt-4 font-serif text-3xl tracking-[-0.04em] text-foreground md:text-5xl">Build the next useful market.</h2>
              </div>
              <Link href="/markets" className="landing-inline-link">See the market directory <ArrowRight className="size-4" /></Link>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {ECOSYSTEM_PATHS.map(({ icon: Icon, label, title, copy, href, action }) => (
                <Link key={label} href={href} className="landing-path group">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow-label">{label}</span>
                    <Icon className="size-4 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" />
                  </div>
                  <h3 className="mt-16 font-serif text-2xl leading-tight tracking-tight text-foreground">{title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{copy}</p>
                  <span className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-foreground">{action} <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 md:px-12 md:py-32">
          <div className="landing-final-cta rounded-[28px] border border-border/70 px-6 py-12 text-center md:px-12 md:py-16">
            <p className="eyebrow-label">The open market layer</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl leading-tight tracking-[-0.045em] text-foreground md:text-6xl">Make the next market easier to create.</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">Start with the markets that exist today, or bring your own asset thesis to the protocol.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/markets" className="editorial-primary-button group">Open the app <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></Link>
              <Link href="/docs" className="editorial-text-link text-sm">Read the documentation</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 px-5 py-8 md:px-12">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-xs text-muted-foreground md:flex-row md:items-center">
          <div className="flex items-center gap-2"><Image src="/openasset-logo-mark.png" alt="" width={20} height={20} className="brand-logo" /><span className="font-semibold text-foreground">OpenAsset</span><span>— open infrastructure for asset lending</span></div>
          <div className="flex flex-wrap gap-5"><Link href="/markets" className="landing-footer-link">Markets</Link><Link href="/portfolio" className="landing-footer-link">Positions</Link><Link href="/account" className="landing-footer-link">Account</Link><Link href="/docs" className="landing-footer-link">Docs</Link></div>
        </div>
      </footer>
    </div>
  );
}
