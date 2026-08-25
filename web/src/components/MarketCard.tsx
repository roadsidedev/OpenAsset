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
        "group block rounded-3xl border border-border bg-card p-6",
        "transition-all duration-200 hover-lift",
        "hover:border-ice-300/50 dark:hover:border-ice-400/30",
        isB20 ? "ring-1 ring-ice-200/50 dark:ring-ice-500/20" : "",
        className
      )}
    >
      <div className="flex flex-col justify-between h-full space-y-5">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="shrink-0 mt-0.5">
                <TokenIcon symbol={isB20 ? b20!.symbol : brandSymbol} logoUri={logoUri} className="h-9 w-9" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-foreground truncate group-hover:text-ice-600 dark:group-hover:text-ice-300">
                  {isB20 ? `${b20!.symbol} Market` : `Market ${market.marketAddress.slice(0, 8)}...`}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono truncate">{isB20 ? b20!.address.slice(0,10)+"..." : market.collateralAsset.slice(0, 10)+"..."}</span>
                  <span className="shrink-0">·</span>
                  <span>{isB20 ? `B20 · ${b20!.name}` : "ERC20"}</span>
                  {isB20 && <span className="rounded-full bg-ice-500/10 dark:bg-ice-400/15 text-ice-600 dark:text-ice-300 px-1.5 py-0.5 text-[10px] font-bold border border-ice-500/20 dark:border-ice-400/20">B20</span>}
                </div>
                {isB20 && (
                  <div className={cn("mt-1 text-[11px] font-medium", hoursOpen ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                    {hoursOpen ? "● Market open (24/5)" : "○ Market closed — originations paused"}
                  </div>
                )}
              </div>
            </div>
            <Badge
              variant={market.active ? "default" : "secondary"}
              className={cn(
                "shrink-0 text-xs font-semibold rounded-full px-2.5 py-0.5",
                market.active
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {market.active ? "Active" : "Inactive"}
            </Badge>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/50 dark:bg-muted/30 p-3 text-xs border border-transparent dark:border-border/50">
            <div>
              <span className="text-muted-foreground block text-xs">Total Liquidity</span>
              <span className="font-bold text-foreground">{formatLiquidity(market.liquidity.total)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Borrow APR</span>
              <span className="font-bold text-ice-600 dark:text-ice-300">{formatApr(market.aprBps)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Max LTV</span>
              <span className="font-bold text-foreground">{formatLtv(market.ltvBps)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Available</span>
              <span className="font-bold text-foreground">{formatLiquidity(market.liquidity.available)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Duration: {formatDuration(market.durationSeconds)}</span>
          <span className="font-semibold text-foreground flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            View Pool <span className="text-xs">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
