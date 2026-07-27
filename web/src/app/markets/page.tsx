"use client";

import { useState } from "react";
import { Search } from "lucide-react";
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
    // Category filter — since the API doesn't return category metadata,
    // we show all markets under "All Markets" and filter client-side
    // when category tabs map to asset types or adapter patterns.
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
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-8">
        {/* Platform Stats Dashboard */}
        <PlatformStatsDashboard />

        {/* Header + Search */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Explore Markets</h1>
            <p className="text-sm text-muted-foreground">
              Permissionless & compliant isolated lending pools for any tokenized asset
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search assets, chains, adapters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 focus:border-transparent placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
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
