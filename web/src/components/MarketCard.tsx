"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TokenIcon } from "@/components/tokens/TokenPreview";
import { resolveTokenLogo } from "@/lib/brandLogos";
import type { Market } from "@/hooks/useMarkets";
import { isB20Token, getB20Info, isWithinB20TradingWindow } from "@/lib/b20";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import { useAccount } from "wagmi";
import { isAddress } from "viem";

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
    const val = parseFloat(available);
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    return `$${val.toFixed(2)}`;
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
  const isB20 = !!b20;
  const hoursOpen = isB20 ? isWithinB20TradingWindow() : true;
  const { chain } = useAccount();
  const chainId = chain?.id;
  const isValidAddr = isAddress(market.collateralAsset as `0x${string}`);
  const { data: collateralMeta } = useTokenMetadata(isValidAddr && !isB20 ? market.collateralAsset : undefined, chainId);
  // Resolve brand logo for market collateral (B20 or generic)
  const metaSymbol = collateralMeta?.symbol;
  const metaLogo = collateralMeta?.logoUri;
  const brandSymbol = isB20 ? b20!.symbol : (metaSymbol || market.collateralAsset?.slice(0, 6) || 'UNKNOWN');
  const logoUri = isB20 ? resolveTokenLogo(b20!.symbol, null) : (metaLogo ?? (metaSymbol ? resolveTokenLogo(metaSymbol, null) : null));

  return (
    <Link
      href={`/markets/${market.marketAddress}`}
      className={cn(
        "group block rounded-2xl border border-border/70 bg-card p-5",
        "transition-colors hover:border-border hover:bg-card",
        "hover-lift",
        isB20 ? "border-ice-200 dark:border-ice-500/20" : "",
        className
      )}
    >
      <div className="flex flex-col justify-between h-full space-y-4">
        {/* Header */}
        <div className="space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="shrink-0">
                <TokenIcon symbol={isB20 ? b20!.symbol : brandSymbol} logoUri={logoUri} className="h-9 w-9" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
                  {isB20 ? `${b20!.symbol} Market` : `Market ${market.marketAddress.slice(0, 8)}…`}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
                  <span className="truncate font-mono tracking-tight">{isB20 ? `${b20!.address.slice(0, 10)}…` : `${market.collateralAsset.slice(0, 10)}…`}</span>
                  <span className="shrink-0 opacity-40">·</span>
                  <span className="shrink-0">{isB20 ? b20!.name : "ERC-20"}</span>
                  {isB20 && <span className="shrink-0 rounded-full border border-ice-200 bg-ice-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-ice-700 dark:border-ice-400/20 dark:bg-ice-400/10 dark:text-ice-300">B20</span>}
                </div>
                {isB20 && (
                  <div className={cn("mt-1.5 text-[11px] font-medium leading-none", hoursOpen ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                    {hoursOpen ? "● Open · 24/5" : "○ Closed — originations paused"}
                  </div>
                )}
              </div>
            </div>
            <Badge
              variant={market.active ? "default" : "secondary"}
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
                market.active
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "border border-border bg-muted text-muted-foreground"
              )}
            >
              {market.active ? "Active" : "Inactive"}
            </Badge>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/40 p-3">
            <div className="space-y-1">
              <span className="block text-[11px] font-medium leading-none text-muted-foreground">Total liquidity</span>
              <span className="block text-sm font-semibold leading-none text-foreground tabular-nums">{formatLiquidity(market.liquidity.total)}</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-medium leading-none text-muted-foreground">Borrow APR</span>
              <span className="block text-sm font-semibold leading-none text-foreground tabular-nums">{formatApr(market.aprBps)}</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-medium leading-none text-muted-foreground">Max LTV</span>
              <span className="block text-sm font-semibold leading-none text-foreground tabular-nums">{formatLtv(market.ltvBps)}</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-medium leading-none text-muted-foreground">Available</span>
              <span className="block text-sm font-semibold leading-none text-foreground tabular-nums">{formatLiquidity(market.liquidity.available)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/60 pt-3.5 text-xs">
          <span className="text-muted-foreground">Duration · {formatDuration(market.durationSeconds)}</span>
          <span className="inline-flex items-center gap-1 font-medium text-foreground transition-transform group-hover:translate-x-0.5">
            View pool <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
