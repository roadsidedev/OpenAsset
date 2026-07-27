"use client";

import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
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
  const [start, setStart] = useState(0);
  const [category, setCategory] = useState<Category>("All Markets");
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useMarkets(start, 50);

  const allMarkets = data?.markets || [];

  const filteredMarkets = allMarkets.filter((m) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        m.marketAddress.toLowerCase().includes(q) ||
        m.collateralAsset.toLowerCase().includes(q) ||
        m.loanAsset.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-6">
        {/* Platform Stats Dashboard */}
        <PlatformStatsDashboard />

        {/* Category Tabs + Search */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-medium scrollbar-hide">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setCategory(tab)}
              className={cn(
                "whitespace-nowrap rounded-xl px-4 py-2 transition-colors",
                category === tab
                  ? "bg-primary text-primary-foreground font-bold"
                  : "bg-card border border-border text-muted-foreground hover:border-ice-300/50 hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}

          {/* Search — circular on mobile, pill on desktop, aligned right */}
          <div className="relative ml-auto shrink-0">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "h-9 border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 focus:border-transparent placeholder:text-muted-foreground",
                "w-9 rounded-full pl-9 pr-0 md:w-56 md:rounded-2xl md:pl-9 md:pr-3"
              )}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Error loading markets: {error.message}
          </div>
        )}

        {/* Markets Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <MarketCardSkeleton key={i} />
              ))
            : filteredMarkets.length > 0
            ? filteredMarkets.map((market) => (
                <MarketCard key={market.marketAddress} market={market} />
              ))
            : (
                <div className="col-span-full text-center py-16">
                  <p className="text-muted-foreground text-sm">No markets found in this category</p>
                </div>
              )}
        </div>
      </main>
    </div>
  );
}
