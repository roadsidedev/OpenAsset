"use client";

import { useState, useMemo } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useMarkets } from "@/hooks/useMarkets";
import { useEnrichedMarkets } from "@/hooks/useEnrichedMarkets";
import { MarketCard } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/skeletons/MarketCardSkeleton";
import { PlatformStatsDashboard } from "@/components/PlatformStatsDashboard";
import { cn } from "@/lib/utils";
import { assetSearchHaystack } from "@/lib/assetIdentity";

const CATEGORY_TABS = [
  "All Markets",
  "RWA",
  "Tokenized Equities",
  "Tokens",
  "NFT",
] as const;

type Category = (typeof CATEGORY_TABS)[number];

export default function MarketsPage() {
  const [start, setStart] = useState(0);
  const [category, setCategory] = useState<Category>("All Markets");
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useMarkets(start, 50);

  const allMarkets = data?.markets || [];
  const { enriched } = useEnrichedMarkets(allMarkets);

  const filteredEnriched = useMemo(() => {
    let list = enriched;
    if (category !== "All Markets") {
      const cat = category as string;
      list = list.filter((e) => e.identity.category === cat);
    }
    if (search) {
      const q = search.toLowerCase().trim();
      if (q) {
        list = list.filter((e) => assetSearchHaystack(e.identity, e.market).includes(q));
      }
    }
    return list;
  }, [enriched, category, search]);

  const filteredMarketsCount = filteredEnriched.length;

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-[1160px] px-4 py-6 md:px-6 md:py-7">
        {/* Market pulse */}
        <section className="space-y-3.5">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-display text-[28px] leading-[0.95] tracking-[-0.025em] text-foreground md:text-[32px]">
              Market pulse
            </h1>
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Network · Active
            </span>
          </div>
          <PlatformStatsDashboard />
        </section>

        {/* Open markets */}
        <section className="mt-8 space-y-4 md:mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-[22px] leading-none tracking-[-0.022em] text-foreground md:text-[24px]">
              Open markets
            </h2>
            <span className="hidden text-xs text-muted-foreground md:inline">
              {filteredMarketsCount} {filteredMarketsCount === 1 ? "market" : "markets"}
            </span>
          </div>

          {/* Filters + Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCategory(tab)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium leading-none transition-colors",
                    category === tab
                      ? "bg-foreground text-background"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/15"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative ml-auto hidden shrink-0 items-center md:flex">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search markets"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-[240px] rounded-full border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground/15 focus:ring-2 focus:ring-foreground/5"
              />
            </div>

          </div>

          {/* Mobile search */}
          <div className="relative md:hidden">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search markets"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-full border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground/15 focus:ring-2 focus:ring-foreground/5"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3.5 text-sm text-destructive">
              Error loading markets: {error.message}
            </div>
          )}

          {/* Markets Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <MarketCardSkeleton key={i} />
                ))
              : filteredEnriched.length > 0
                ? filteredEnriched.map(({ market, identity, oracleLabel, loanAssetSymbol }) => (
                    <MarketCard
                      key={market.marketAddress}
                      market={market}
                      identity={identity}
                      oracleLabel={oracleLabel}
                      loanAssetSymbol={loanAssetSymbol}
                    />
                  ))
                : (
                    <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/50 py-12 text-center">
                      <p className="text-sm font-medium text-foreground">No markets found</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try a different category or search term</p>
                    </div>
                  )}
          </div>
        </section>
      </main>
    </div>
  );
}
