"use client";

import { useMemo, useState } from "react";
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
type SortBy = "liquidity" | "ltv" | "apr" | "duration";

function liquidityUsd(value: string | undefined): number {
  try {
    return Number(BigInt(value || "0")) / 1_000_000;
  } catch {
    return 0;
  }
}

export default function MarketsPage() {
  const [category, setCategory] = useState<Category>("All Markets");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("liquidity");
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [showLiquidOnly, setShowLiquidOnly] = useState(false);
  const [ltvRange, setLtvRange] = useState<[number, number]>([0, 10000]);
  const [aprRange, setAprRange] = useState<[number, number]>([0, 10000]);
  const [minLiquidityUsd, setMinLiquidityUsd] = useState(0);
  const [creatorSearch, setCreatorSearch] = useState("");
  const { data, isLoading, error } = useMarkets(0, 50);

  const allMarkets = data?.markets || [];
  const { enriched } = useEnrichedMarkets(allMarkets);

  const filteredEnriched = useMemo(() => {
    let list = enriched;
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedCreator = creatorSearch.trim().toLowerCase();

    if (category !== "All Markets") {
      list = list.filter((entry) => entry.identity.category === category);
    }
    if (normalizedSearch) {
      list = list.filter((entry) => assetSearchHaystack(entry.identity, entry.market).includes(normalizedSearch));
    }
    if (normalizedCreator) {
      list = list.filter((entry) => (entry.market.owner || "").toLowerCase().includes(normalizedCreator));
    }
    if (showActiveOnly) {
      list = list.filter((entry) => entry.market.active);
    }
    if (showLiquidOnly) {
      list = list.filter((entry) => liquidityUsd(entry.market.liquidity.available) > 0);
    }
    if (showVerifiedOnly) {
      const emptyProviderId = `0x${"0".repeat(64)}`;
      list = list.filter(
        (entry) =>
          (!!entry.market.providerId && entry.market.providerId !== emptyProviderId) ||
          entry.identity.category !== "Tokens" ||
          entry.market.ltvBps <= 7500,
      );
    }

    list = list.filter(
      (entry) => entry.market.ltvBps >= ltvRange[0] && entry.market.ltvBps <= ltvRange[1],
    );
    list = list.filter(
      (entry) => entry.market.aprBps >= aprRange[0] && entry.market.aprBps <= aprRange[1],
    );
    if (minLiquidityUsd > 0) {
      list = list.filter((entry) => liquidityUsd(entry.market.liquidity.available) >= minLiquidityUsd);
    }

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "liquidity":
          return liquidityUsd(b.market.liquidity.available) - liquidityUsd(a.market.liquidity.available);
        case "ltv":
          return b.market.ltvBps - a.market.ltvBps;
        case "apr":
          return a.market.aprBps - b.market.aprBps;
        case "duration":
          return a.market.durationSeconds - b.market.durationSeconds;
      }
    });
  }, [
    enriched,
    category,
    search,
    creatorSearch,
    showActiveOnly,
    showLiquidOnly,
    showVerifiedOnly,
    ltvRange,
    aprRange,
    minLiquidityUsd,
    sortBy,
  ]);

  const ltvFilterValue =
    ltvRange[0] === 0 && ltvRange[1] === 10000
      ? "all"
      : ltvRange[0] === 0 && ltvRange[1] === 5000
        ? "conservative"
        : ltvRange[0] === 5000 && ltvRange[1] === 7500
          ? "balanced"
          : ltvRange[0] === 7500 && ltvRange[1] === 9500
            ? "aggressive"
            : "custom";
  const aprFilterValue =
    aprRange[0] === 0 && aprRange[1] === 10000
      ? "all"
      : aprRange[0] === 0 && aprRange[1] === 1000
        ? "low"
        : aprRange[0] === 1000 && aprRange[1] === 3000
          ? "mid"
          : aprRange[0] === 3000 && aprRange[1] === 10000
            ? "high"
            : "custom";

  const hasAdvancedFilters =
    showVerifiedOnly ||
    showActiveOnly ||
    showLiquidOnly ||
    creatorSearch.trim() !== "" ||
    ltvRange[0] !== 0 ||
    ltvRange[1] !== 10000 ||
    aprRange[0] !== 0 ||
    aprRange[1] !== 10000 ||
    minLiquidityUsd !== 0 ||
    sortBy !== "liquidity";

  const resetFilters = () => {
    setCategory("All Markets");
    setSearch("");
    setSortBy("liquidity");
    setShowVerifiedOnly(false);
    setShowActiveOnly(false);
    setShowLiquidOnly(false);
    setLtvRange([0, 10000]);
    setAprRange([0, 10000]);
    setMinLiquidityUsd(0);
    setCreatorSearch("");
  };

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-[1160px] px-4 py-6 md:px-6 md:py-7">
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

        <section className="mt-8 space-y-4 md:mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-[22px] leading-none tracking-[-0.022em] text-foreground md:text-[24px]">
              Open markets
            </h2>
            <span className="hidden text-xs text-muted-foreground md:inline">
              {filteredEnriched.length} {filteredEnriched.length === 1 ? "market" : "markets"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex max-w-full items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCategory(tab)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium leading-none transition-colors",
                    category === tab
                      ? "bg-foreground text-background"
                      : "border border-border bg-card text-muted-foreground hover:border-foreground/15 hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative ml-auto hidden shrink-0 items-center md:flex">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                aria-label="Search markets by asset, issuer, address, or loan token"
                placeholder="Search markets"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-[240px] rounded-full border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-foreground/15 focus:outline-none focus:ring-2 focus:ring-foreground/5"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <label htmlFor="market-sort" className="text-xs font-medium text-muted-foreground">
                Sort
              </label>
              <select
                id="market-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
                className="h-8 rounded-full border border-border bg-muted/50 px-3 text-xs"
              >
                <option value="liquidity">Liquidity ↓</option>
                <option value="ltv">Max LTV ↓</option>
                <option value="apr">Lowest APR</option>
                <option value="duration">Duration ↑</option>
              </select>
            </div>
            <div className="hidden h-6 w-px bg-border sm:block" />
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(event) => setShowActiveOnly(event.target.checked)}
                className="h-3.5 w-3.5 rounded"
              />
              Active only
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={showLiquidOnly}
                onChange={(event) => setShowLiquidOnly(event.target.checked)}
                className="h-3.5 w-3.5 rounded"
              />
              Has liquidity
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={showVerifiedOnly}
                onChange={(event) => setShowVerifiedOnly(event.target.checked)}
                className="h-3.5 w-3.5 rounded"
              />
              Verified / low-risk
            </label>
            <div className="hidden h-6 w-px bg-border sm:block" />

            <div className="flex items-center gap-1.5">
              <label htmlFor="market-ltv" className="text-xs font-medium text-muted-foreground">
                LTV
              </label>
              <select
                id="market-ltv"
                value={ltvFilterValue}
                onChange={(event) => {
                  switch (event.target.value) {
                    case "conservative":
                      setLtvRange([0, 5000]);
                      break;
                    case "balanced":
                      setLtvRange([5000, 7500]);
                      break;
                    case "aggressive":
                      setLtvRange([7500, 9500]);
                      break;
                    default:
                      setLtvRange([0, 10000]);
                  }
                }}
                className="h-8 rounded-full border border-border bg-muted/50 px-3 text-xs"
              >
                <option value="all">All LTV</option>
                <option value="conservative">≤50% (conservative)</option>
                <option value="balanced">50–75% (balanced)</option>
                <option value="aggressive">75–95% (aggressive)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="market-apr" className="text-xs font-medium text-muted-foreground">
                APR
              </label>
              <select
                id="market-apr"
                value={aprFilterValue}
                onChange={(event) => {
                  switch (event.target.value) {
                    case "low":
                      setAprRange([0, 1000]);
                      break;
                    case "mid":
                      setAprRange([1000, 3000]);
                      break;
                    case "high":
                      setAprRange([3000, 10000]);
                      break;
                    default:
                      setAprRange([0, 10000]);
                  }
                }}
                className="h-8 rounded-full border border-border bg-muted/50 px-3 text-xs"
              >
                <option value="all">All APR</option>
                <option value="low">≤10% (cheap)</option>
                <option value="mid">10–30%</option>
                <option value="high">30%+ (yield)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="market-liquidity" className="text-xs font-medium text-muted-foreground">
                Min liquidity
              </label>
              <select
                id="market-liquidity"
                value={minLiquidityUsd}
                onChange={(event) => setMinLiquidityUsd(Number(event.target.value))}
                className="h-8 rounded-full border border-border bg-muted/50 px-3 text-xs"
              >
                <option value={0}>Any</option>
                <option value={1000}>$1K+</option>
                <option value={10000}>$10K+</option>
                <option value={100000}>$100K+</option>
              </select>
            </div>

            <input
              type="search"
              aria-label="Filter markets by creator address"
              placeholder="Creator address"
              value={creatorSearch}
              onChange={(event) => setCreatorSearch(event.target.value)}
              className="h-8 w-[150px] rounded-full border border-border bg-muted/50 px-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ice-400"
            />

            {hasAdvancedFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Reset filters
              </button>
            )}
            <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
              Search by asset, issuer, address, or loan token
            </span>
          </div>

          <div className="relative md:hidden">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search markets by asset, issuer, address, or loan token"
              placeholder="Search markets"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-full rounded-full border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-foreground/15 focus:outline-none focus:ring-2 focus:ring-foreground/5"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3.5 text-sm text-destructive">
              Error loading markets: {error.message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, index) => <MarketCardSkeleton key={index} />)
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
