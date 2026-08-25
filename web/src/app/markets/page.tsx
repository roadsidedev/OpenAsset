"use client";

import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useMarkets } from "@/hooks/useMarkets";
import { MarketCard } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/skeletons/MarketCardSkeleton";
import { PlatformStatsDashboard } from "@/components/PlatformStatsDashboard";
import { cn } from "@/lib/utils";

const CATEGORY_TABS = ["All Markets", "RWA", "Tokenized Equities", "Tokens", "NFT"] as const;
type Category = (typeof CATEGORY_TABS)[number];

export default function MarketsPage() {
  const [start] = useState(0);
  const [category, setCategory] = useState<Category>("All Markets");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { data, isLoading, error } = useMarkets(start, 50);
  const allMarkets = data?.markets || [];
  const filteredMarkets = allMarkets.filter((market) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return market.marketAddress.toLowerCase().includes(query) || market.collateralAsset.toLowerCase().includes(query) || market.loanAsset.toLowerCase().includes(query);
  });

  return (
    <div className="app-page min-h-dvh">
      <main className="mx-auto max-w-7xl space-y-10 px-4 pb-20 pt-8 md:px-8 md:pt-12">
        <section aria-labelledby="market-pulse-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow-label">Protocol signal</p><h1 id="market-pulse-heading" className="mt-2 font-serif text-3xl tracking-tight text-foreground">Market pulse</h1></div><div className="editorial-status-label"><span className="editorial-status-dot" />Network · Active</div></div>
          <div className="editorial-stats-grid"><PlatformStatsDashboard /></div>
        </section>

        <section id="markets" className="scroll-mt-24" aria-labelledby="markets-heading">
          <div className="mb-5"><p className="eyebrow-label">Explore liquidity</p><h2 id="markets-heading" className="mt-2 font-serif text-3xl tracking-tight text-foreground md:text-4xl">Open markets</h2></div>
          <div className="market-filter-row mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide" aria-label="Market categories">
            {CATEGORY_TABS.map((tab) => <button key={tab} type="button" onClick={() => setCategory(tab)} className={cn("editorial-filter whitespace-nowrap", category === tab && "editorial-filter-active")}>{tab}</button>)}
            <div className={cn("market-search-control relative ml-auto shrink-0", searchOpen && "market-search-control-open")}>
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" aria-label="Search markets" placeholder="Search markets" value={search} onChange={(event) => setSearch(event.target.value)} className="editorial-input h-10 w-10 cursor-pointer pl-10 pr-3 md:h-11 md:w-64 md:cursor-text" />
              <button type="button" aria-label={searchOpen ? "Close market search" : "Open market search"} aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)} className="market-search-toggle absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-full text-muted-foreground md:hidden"><span className="sr-only">{searchOpen ? "Close market search" : "Open market search"}</span></button>
            </div>
          </div>
          {error && <div className="editorial-error mb-6 rounded-2xl p-4 text-sm text-destructive">Error loading markets: {error.message}</div>}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? Array.from({ length: 6 }).map((_, index) => <MarketCardSkeleton key={index} />) : filteredMarkets.length > 0 ? filteredMarkets.map((market) => <MarketCard key={market.marketAddress} market={market} />) : <div className="editorial-empty col-span-full py-20 text-center"><p className="font-serif text-xl text-foreground">No markets found</p><p className="mt-2 text-sm text-muted-foreground">Try another search or browse a different category.</p></div>}
          </div>
        </section>
      </main>
    </div>
  );
}
