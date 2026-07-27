"use client";

import { useProtocolStats, formatTvl } from "@/hooks/useProtocolStats";

export function ProtocolStatsBar() {
  const { data, isLoading, error } = useProtocolStats();

  if (isLoading) {
    return (
      <section className="border-y border-white/5 bg-muted/30 py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-10 w-32 mx-auto animate-pulse rounded-lg bg-muted" />
                <div className="mt-2 h-4 w-24 mx-auto animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return null; // Don't show stats on error
  }

  return (
    <section className="border-y border-white/5 bg-muted/30 py-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
          <div>
            <div className="text-4xl font-bold text-foreground tabular-nums">{formatTvl(data.tvl)}</div>
            <div className="text-sm uppercase tracking-wider text-muted-foreground">Total Value Locked</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-foreground tabular-nums">{data.activeMarkets}</div>
            <div className="text-sm uppercase tracking-wider text-muted-foreground">Active Markets</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-foreground tabular-nums">{data.totalMarkets}</div>
            <div className="text-sm uppercase tracking-wider text-muted-foreground">Markets Created</div>
          </div>
        </div>
      </div>
    </section>
  );
}
