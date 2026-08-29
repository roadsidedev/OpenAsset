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
  const [sortBy, setSortBy] = useState<"liquidity" | "ltv" | "apr" | "duration">("liquidity");
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [showLiquidOnly, setShowLiquidOnly] = useState(false);
  const [ltvRange, setLtvRange] = useState<[number, number]>([0, 10000]);
  const [aprRange, setAprRange] = useState<[number, number]>([0, 10000]);
  const [minLiquidityUsd, setMinLiquidityUsd] = useState(0);
  const [creatorSearch, setCreatorSearch] = useState("");
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
    if (creatorSearch) {
      const q = creatorSearch.toLowerCase().trim();
      list = list.filter((e) => (e.market.owner || "").toLowerCase().includes(q));
    }
    if (showActiveOnly) list = list.filter((e) => e.market.active);
    if (showLiquidOnly) list = list.filter((e) => parseFloat(e.market.liquidity.available || "0") > 0);
    if (showVerifiedOnly) {
      // Verified = B20/Robinhood provider markets (verified adapters by definition), or low-risk tokens (LTV ≤75%)
      list = list.filter((e) => (!!e.market.providerId && e.market.providerId !== "0x" + "0".repeat(64)) || e.identity.category !== "Tokens" || e.market.ltvBps <= 7500);
    }
    // LTV range (in bps)
    list = list.filter((e) => e.market.ltvBps >= ltvRange[0] && e.market.ltvBps <= ltvRange[1]);
    // APR range (in bps)
    list = list.filter((e) => e.market.aprBps >= aprRange[0] && e.market.aprBps <= aprRange[1]);
    // Minimum available liquidity (in lending token units, ~USDC 6dp)
    if (minLiquidityUsd > 0) {
      list = list.filter((e) => parseFloat(e.market.liquidity.available || "0") >= minLiquidityUsd);
    }
    // Sort
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "liquidity": return parseFloat(b.market.liquidity.available || "0") - parseFloat(a.market.liquidity.available || "0");
        case "ltv": return b.market.ltvBps - a.market.ltvBps;
        case "apr": return a.market.aprBps - b.market.aprBps; // lowest APR first
        case "duration": return a.market.durationSeconds - b.market.durationSeconds;
        default: return 0;
      }
    });
    return sorted;
  }, [enriched, category, search, creatorSearch, showActiveOnly, showLiquidOnly, showVerifiedOnly, ltvRange, aprRange, minLiquidityUsd, sortBy]);

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
          <div className="flex flex-wrap items-center gap-2">
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

          {/* Advanced filters — enterprise discovery (R-11) */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">Sort</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="h-8 rounded-full border border-border bg-muted/50 px-3 text-xs">
                <option value="liquidity">Liquidity ↓</option>
                <option value="ltv">Max LTV ↓</option>
                <option value="apr">Lowest APR</option>
                <option value="duration">Duration ↑</option>
              </select>
            </div>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={showActiveOnly} onChange={(e) => setShowActiveOnly(e.target.checked)} className="h-3.5 w-3.5 rounded" />
              Active only
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={showLiquidOnly} onChange={(e) => setShowLiquidOnly(e.target.checked)} className="h-3.5 w-3.5 rounded" />
              Has liquidity
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={showVerifiedOnly} onChange={(e) => setShowVerifiedOnly(e.target.checked)} className="h-3.5 w-3.5 rounded" />
              Verified / low-risk
            </label>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">LTV</label>
              <select value={`${ltvRange[0]}-${ltvRange[1]}`} onChange={(e) => {
                const v = e.target.value;
                if (v === "all") setLtvRange([0,10000]);
                else if (v === "conservative") setLtvRange([0,5000]);
                else if (v === "balanced") setLtvRange([5000,7500]);
                else if (v === "aggressive") setLtvRange([7500,9500]);
              }} className="h-8 rounded-full border border-border bg-muted/50 px-3 text-xs">
                <option value="all">All LTV</option>
                <option value="conservative">≤50% (conservative)</option>
                <option value="balanced">50–75% (balanced)</option>
                <option value="aggressive">75–95% (aggressive)</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">APR</label>
              <select value={`${aprRange[0]}-${aprRange[1]}`} onChange={(e) => {
                const v = e.target.value;
                if (v === "all") setAprRange([0,10000]);
                else if (v === "low") setAprRange([0,1000]);
                else if (v === "mid") setAprRange([1000,3000]);
                else if (v === "high") setAprRange([3000,10000]);
              }} className="h-8 rounded-full border border-border bg-muted/50 px-3 text-xs">
                <option value="all">All APR</option>
                <option value="low">≤10% (cheap)</option>
                <option value="mid">10–30%</option>
                <option value="high">30%+ (yield)</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min liquidity</label>
              <select value={minLiquidityUsd} onChange={(e) => setMinLiquidityUsd(Number(e.target.value))} className="h-8 rounded-full border border-border bg-muted/50 px-3 text-xs">
                <option value={0}>Any</option>
                <option value={1000}>$1K+</option>
                <option value={10000}>$10K+</option>
                <option value={100000}>$100K+</option>
              </select>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Creator address"
                value={creatorSearch}
                onChange={(e) => setCreatorSearch(e.target.value)}
                className="h-8 w-[150px] rounded-full border border-border bg-muted/50 pl-3 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ice-400"
              />
            </div>
            {(showVerifiedOnly || showLiquidOnly || creatorSearch || aprRange[0] !== 0 || aprRange[1] !== 10000 || minLiquidityUsd !== 0) && (
              <button
                onClick={() => { setShowVerifiedOnly(false); setShowLiquidOnly(false); setCreatorSearch(""); setAprRange([0,10000]); setMinLiquidityUsd(0); setLtvRange([0,10000]); }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Reset filters
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground hidden md:inline">Risk on each card: LTV · APR · liquidity · duration</span>
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
