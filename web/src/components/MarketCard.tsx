"use client";

import Link from "next/link";
import { ArrowUpRight, Circle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Market } from "@/hooks/useMarkets";

function formatLtv(ltvBps: number) {
  return `${(ltvBps / 100).toFixed(1)}%`;
}

function formatApr(aprBps: number) {
  return `${(aprBps / 100).toFixed(1)}%`;
}

function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  return `${days}d`;
}

function formatLiquidity(available: string) {
  try {
    const value = parseFloat(available);
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  } catch {
    return "$0";
  }
}

interface MarketCardProps {
  market: Market;
  className?: string;
}

export function MarketCard({ market, className }: MarketCardProps) {
  return (
    <Link
      href={`/markets/${market.marketAddress}`}
      className={cn("market-card group block", className)}
    >
      <div className="relative z-10 flex h-full flex-col justify-between gap-7">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Circle className={cn("size-2 fill-current", market.active ? "text-emerald-400" : "text-muted-foreground")} />
                {market.active ? "Active market" : "Inactive market"}
              </div>
              <h3 className="font-serif text-xl tracking-tight text-foreground transition-colors duration-300 group-hover:text-ice-600 dark:group-hover:text-ice-300">
                Market {market.marketAddress.slice(0, 8)}...
              </h3>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono truncate">{market.collateralAsset.slice(0, 10)}...</span>
                <span aria-hidden="true">·</span>
                <span>ERC20</span>
              </div>
            </div>
            <span className="rounded-full border border-border/80 bg-background/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {formatDuration(market.durationSeconds)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-y border-border/70 py-4 text-xs">
            <div>
              <span className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Total liquidity</span>
              <span className="mt-1 block font-serif text-lg text-foreground">{formatLiquidity(market.liquidity.total)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Borrow APR</span>
              <span className="mt-1 block font-serif text-lg text-ice-600 dark:text-ice-300">{formatApr(market.aprBps)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Max LTV</span>
              <span className="mt-1 block font-serif text-lg text-foreground">{formatLtv(market.ltvBps)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Available</span>
              <span className="mt-1 block font-serif text-lg text-foreground">{formatLiquidity(market.liquidity.available)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-[0.12em]">Permissionless pool</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground transition-transform duration-300 group-hover:translate-x-1">
            View market <ArrowUpRight className="size-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
