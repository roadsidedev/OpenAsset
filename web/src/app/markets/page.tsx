"use client";

import { useMemo } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { useEnrichedMarkets } from "@/hooks/useEnrichedMarkets";
import { MarketCard } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/skeletons/MarketCardSkeleton";
import { PlatformStatsDashboard } from "@/components/PlatformStatsDashboard";

export default function MarketsPage() {
  const { data, isLoading } = useMarkets(0, 50);
  const { enriched } = useEnrichedMarkets(data?.markets || []);

  const filteredEnriched = useMemo(() => {
    return enriched.filter((e) => e.market.active);
  }, [enriched]);

  const filteredMarketsCount = filteredEnriched.length;

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
              {filteredMarketsCount} {filteredMarketsCount === 1 ? "market" : "markets"}
            </span>
          </div>

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