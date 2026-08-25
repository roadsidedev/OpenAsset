"use client";

import Link from "next/link";
import { ArrowUpRight, Circle } from "@phosphor-icons/react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { cn } from "@/lib/utils";
import type { Market } from "@/hooks/useMarkets";
import { TokenIcon } from "@/components/tokens/TokenPreview";
import { resolveTokenLogo } from "@/lib/brandLogos";
import { isB20Token, getB20Info, isWithinB20TradingWindow } from "@/lib/b20";
import { useTokenMetadata } from "@/lib/tokenMetadata";

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
  const b20 = isB20Token(market.collateralAsset) ? getB20Info(market.collateralAsset) : undefined;
  const isB20 = Boolean(b20);
  const hoursOpen = isB20 ? isWithinB20TradingWindow() : true;
  const { chain } = useAccount();
  const isValidAddress = isAddress(market.collateralAsset as `0x${string}`);
  const { data: collateralMetadata } = useTokenMetadata(
    isValidAddress && !isB20 ? market.collateralAsset : undefined,
    chain?.id
  );
  const marketSymbol = isB20
    ? b20!.symbol
    : collateralMetadata?.symbol || market.collateralAsset?.slice(0, 6) || "UNKNOWN";
  const logoUri = isB20
    ? resolveTokenLogo(b20!.symbol, null)
    : collateralMetadata?.logoUri ?? (collateralMetadata?.symbol ? resolveTokenLogo(collateralMetadata.symbol, null) : null);

  return (
    <Link
      href={`/markets/${market.marketAddress}`}
      className={cn("market-card group block", isB20 && "market-card-b20", className)}
    >
      <div className="relative z-10 flex h-full flex-col justify-between gap-7">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <TokenIcon symbol={marketSymbol} logoUri={logoUri} className="mt-0.5 size-10 shrink-0" />
              <div className="min-w-0">
                <div className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <Circle className={cn("size-2 fill-current", market.active ? "text-emerald-400" : "text-muted-foreground")} />
                  {market.active ? "Active market" : "Inactive market"}
                </div>
                <h3 className="font-serif text-xl tracking-tight text-foreground transition-colors duration-300 group-hover:text-ice-600 dark:group-hover:text-ice-300">
                  {isB20 ? `${b20!.symbol} Market` : `Market ${market.marketAddress.slice(0, 8)}...`}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate font-mono">{isB20 ? `${b20!.address.slice(0, 10)}...` : `${market.collateralAsset.slice(0, 10)}...`}</span>
                  <span aria-hidden="true">·</span>
                  <span>{isB20 ? `B20 · ${b20!.name}` : "ERC20"}</span>
                </div>
                {isB20 && (
                  <div className={cn("mt-1 text-[11px] font-medium", hoursOpen ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                    {hoursOpen ? "● Market open (24/5)" : "○ Market closed — originations paused"}
                  </div>
                )}
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-border/80 bg-background/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
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
