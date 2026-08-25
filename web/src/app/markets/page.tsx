"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { useMarkets } from "@/hooks/useMarkets";
import { MarketCard } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/skeletons/MarketCardSkeleton";
import { PlatformStatsDashboard } from "@/components/PlatformStatsDashboard";
import { cn } from "@/lib/utils";

const CATEGORY_TABS = [
  "All Markets",
  "RWA",
  "Tokenized Equities",
  "Tokens",
  "NFT",
] as const;

type Category = (typeof CATEGORY_TABS)[number];

export default function MarketsPage() {
  const [start] = useState(0);
  const [category, setCategory] = useState<Category>("All Markets");
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useMarkets(start, 50);

  const allMarkets = data?.markets || [];

  const filteredMarkets = allMarkets.filter((market) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      market.marketAddress.toLowerCase().includes(query) ||
      market.collateralAsset.toLowerCase().includes(query) ||
      market.loanAsset.toLowerCase().includes(query)
    );
  });

  return (
    <div className="app-page min-h-dvh">
      <main className="mx-auto max-w-7xl space-y-10 px-4 pb-20 pt-8 md:px-8 md:pt-12">
        <section className="editorial-hero relative overflow-hidden rounded-[32px] border border-border/80 px-6 py-10 md:px-12 md:py-14">
          <div className="editorial-hero-glow" aria-hidden="true" />
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow-label">Open Asset Market · Live liquidity</p>
            <h1 className="mt-5 max-w-3xl font-serif text-4xl leading-[0.98] tracking-[-0.045em] text-foreground md:text-6xl lg:text-7xl">
              Lend against <span className="text-ice-500 dark:text-ice-300">what matters.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              Permissionless markets for real-world assets, tokens, and onchain credit.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href="#markets" className="editorial-primary-button group">
                Explore markets
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
              <Link href="/create-market" className="editorial-text-link">
                Create a market
              </Link>
            </div>
          </div>

          <div className="editorial-hero-logo" aria-hidden="true">
            <div className="editorial-hero-logo-halo" />
            <Image
              src="/openasset-logo-mark.png"
              alt=""
              width={360}
              height={360}
              priority
              className="brand-logo editorial-hero-logo-image"
            />
          </div>
        </section>

        <section className="editorial-section" aria-labelledby="market-pulse-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow-label">Protocol signal</p>
              <h2 id="market-pulse-heading" className="mt-2 font-serif text-2xl tracking-tight text-foreground md:text-3xl">
                Market pulse
              </h2>
            </div>
            <div className="editorial-status-label">
              <span className="editorial-status-dot" />
              Network · Active
            </div>
          </div>
          <div className="editorial-stats-grid">
            <PlatformStatsDashboard />
          </div>
        </section>

        <section id="markets" className="scroll-mt-24" aria-labelledby="markets-heading">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow-label">Explore liquidity</p>
              <h2 id="markets-heading" className="mt-2 font-serif text-3xl tracking-tight text-foreground md:text-4xl">
                Open markets
              </h2>
            </div>
            <div className="relative w-full md:w-64">
              <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search markets"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="editorial-input h-11 w-full pl-10 pr-4"
              />
            </div>
          </div>

          <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCategory(tab)}
                className={cn("editorial-filter whitespace-nowrap", category === tab && "editorial-filter-active")}
              >
                {tab}
              </button>
            ))}
          </div>

          {error && (
            <div className="editorial-error mb-6 rounded-2xl p-4 text-sm text-destructive">
              Error loading markets: {error.message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, index) => <MarketCardSkeleton key={index} />)
              : filteredMarkets.length > 0
                ? filteredMarkets.map((market) => <MarketCard key={market.marketAddress} market={market} />)
                : (
                  <div className="editorial-empty col-span-full py-20 text-center">
                    <p className="font-serif text-xl text-foreground">No markets found</p>
                    <p className="mt-2 text-sm text-muted-foreground">Try another search or browse a different category.</p>
                  </div>
                )}
          </div>
        </section>
      </main>
    </div>
  );
}
