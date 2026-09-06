"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TokenIcon } from "@/components/tokens/TokenPreview";
import type { Market } from "@/hooks/useMarkets";
import type { AssetIdentity } from "@/lib/assetIdentity";
import { isWithinB20TradingWindow } from "@/lib/b20";

function formatLtv(ltvBps: number) {
  return `${(ltvBps / 100).toFixed(1)}%`;
}

function formatApr(aprBps: number) {
  return `${(aprBps / 100).toFixed(1)}%`;
}

function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  if (days === 0) return "<1d";
  return `${days}d`;
}

function formatLiquidity(available: string) {
  try {
    const val = parseFloat(available);
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    if (val >= 1) return `$${val.toFixed(2)}`;
    if (val === 0) return "$0";
    return `$${val.toFixed(2)}`;
  } catch {
    return "$0";
  }
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface MarketCardProps {
  market: Market;
  identity?: AssetIdentity | null;
  oracleLabel?: string;
  loanAssetSymbol?: string | null;
  className?: string;
}

export function MarketCard({ market, identity, oracleLabel, loanAssetSymbol, className }: MarketCardProps) {
  const id: AssetIdentity | null = identity || null;
  const displaySymbol = id?.displaySymbol || (market.collateralAsset ? market.collateralAsset.slice(2, 6).toUpperCase() : market.marketAddress.slice(2, 6).toUpperCase());
  const displayName = id?.name || "Unknown Asset";
  const issuerLabel = id?.issuer || null;
  const categoryLabel = id?.categoryLabel || "Tokens";
  const logoUri = id?.logoUri || null;
  const category = id?.category || "Tokens";
  const isB20 = !!id?.isB20;
  const hoursOpen = isB20 ? isWithinB20TradingWindow() : true;
  const showCategoryPill = true;

  const loanSym = loanAssetSymbol || (market.loanAsset ? shortAddr(market.loanAsset).toUpperCase() : "—");
  const collateralShort = market.collateralAsset ? shortAddr(market.collateralAsset) : shortAddr(market.marketAddress);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLAnchorElement | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const cleanupTimers = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    hoverTimer.current = null;
    longPressTimer.current = null;
  }, []);

  useEffect(() => {
    return () => cleanupTimers();
  }, [cleanupTimers]);

  const openPreview = useCallback((x: number, y: number) => {
    cleanupTimers();
    setPreviewPos({ x, y });
    setPreviewOpen(true);
  }, [cleanupTimers]);

  const closePreview = useCallback(() => {
    cleanupTimers();
    setPreviewOpen(false);
    setPreviewPos(null);
  }, [cleanupTimers]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.right + 12;
    const y = Math.max(8, Math.min(window.innerHeight - 320, rect.top));
    hoverTimer.current = setTimeout(() => openPreview(x, y), 200);
  }, [openPreview]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    closePreview();
  }, [closePreview]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLAnchorElement>) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      const x = Math.min(touch.clientX + 16, window.innerWidth - 300);
      const y = Math.max(8, Math.min(window.innerHeight - 360, touch.clientY - 180));
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
      openPreview(x, y);
    }, 300);
  }, [openPreview]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLAnchorElement>) => {
    const touch = e.touches?.[0];
    if (!touch || !touchStartPos.current) return;
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    touchStartPos.current = null;
    if (previewOpen) closePreview();
  }, [previewOpen, closePreview]);

  return (
    <Link
      href={`/markets/${market.marketAddress}`}
      ref={cardRef}
      className={cn(
        "group relative flex h-full flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 select-none",
        "transition-colors hover:border-border hover:bg-card",
        "hover-lift",
        isB20 ? "border-ice-200 dark:border-ice-500/20" : "",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="shrink-0">
              <TokenIcon symbol={displaySymbol} logoUri={logoUri} className="h-10 w-10" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
                  {displaySymbol}
                </h3>
                {showCategoryPill && (
                  <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                    {categoryLabel}
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-[13px] font-medium leading-tight text-foreground">
                {displayName}
                {issuerLabel && issuerLabel.toLowerCase() !== displayName.toLowerCase() ? (
                  <span className="font-normal text-muted-foreground"> · {issuerLabel}</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
                <span className="font-mono tracking-tight">{collateralShort}</span>
                <span className="opacity-40">·</span>
                <span className="font-medium">→ {loanSym}</span>
                {oracleLabel && oracleLabel !== "—" ? (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="shrink-0">{oracleLabel}</span>
                  </>
                ) : null}
              </div>
              {isB20 && (
                <div
                  className={cn(
                    "mt-1.5 text-[11px] font-medium leading-none",
                    hoursOpen ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {hoursOpen ? "● Open · 24/5" : "○ Closed — originations paused"}
                </div>
              )}
              {!isB20 && category === "NFT" && (
                <div className="mt-1.5 text-[11px] font-medium leading-none text-muted-foreground">NFT collateral</div>
              )}
            </div>
          </div>
          <Badge
            variant={market.active ? "default" : "secondary"}
            className={cn(
              "shrink-0 rounded-full px-2 py-1 text-[11px] font-medium leading-none",
              market.active
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "border border-border bg-muted text-muted-foreground"
            )}
          >
            {market.active ? "Active" : "Inactive"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/40 p-3">
          <div className="space-y-1">
            <span className="block text-[11px] font-medium leading-none text-muted-foreground">Total liquidity</span>
            <span className="block text-sm font-semibold leading-none text-foreground tabular-nums">
              {formatLiquidity(market.liquidity.total)}
            </span>
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
            <span className="block text-sm font-semibold leading-none text-foreground tabular-nums">
              {formatLiquidity(market.liquidity.available)}
            </span>
          </div>
        </div>
      </div>

      {!isB20 && (
        <div
          className={cn(
            "mt-3 flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-medium",
            market.ltvBps <= 5000
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
              : market.ltvBps <= 7500
                ? "border-ice-500/20 bg-ice-500/5 text-ice-600 dark:text-ice-300"
                : market.ltvBps <= 8500
                  ? "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                  : "border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400"
          )}
        >
          <span>Risk · {market.ltvBps <= 5000 ? "Conservative" : market.ltvBps <= 7500 ? "Balanced" : market.ltvBps <= 8500 ? "Aggressive" : "High"}</span>
          <span>{formatLtv(market.ltvBps)} LTV</span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
        <span className="text-muted-foreground">Duration · {formatDuration(market.durationSeconds)}</span>
        {market.owner ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground" title={`Created by ${market.owner}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-ice-400" />
            {shortAddr(market.owner)}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 font-medium text-foreground transition-transform group-hover:translate-x-0.5">
          View pool <span aria-hidden>→</span>
        </span>
      </div>

      <AnimatePresence>
        {previewOpen && previewPos && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed z-50 w-80 max-w-[calc(100vw-24px)] touch-none select-none rounded-xl border border-neutral-800 bg-neutral-900/90 p-4 shadow-2xl backdrop-blur-md"
            style={{ left: previewPos.x, top: previewPos.y }}
            onMouseEnter={() => {
              if (hoverTimer.current) clearTimeout(hoverTimer.current);
              hoverTimer.current = null;
            }}
            onMouseLeave={closePreview}
          >
            <div className="flex items-center gap-3">
              <TokenIcon symbol={displaySymbol} logoUri={logoUri} className="h-10 w-10" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-100">{displayName}</div>
                <div className="text-xs text-neutral-400">{displaySymbol} · {categoryLabel}</div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs text-neutral-300">
              <div className="flex justify-between">
                <span className="text-neutral-400">Liquidity</span>
                <span className="tabular-nums text-neutral-100">{formatLiquidity(market.liquidity.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Borrow APR</span>
                <span className="tabular-nums text-neutral-100">{formatApr(market.aprBps)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Max LTV</span>
                <span className="tabular-nums text-neutral-100">{formatLtv(market.ltvBps)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Oracle</span>
                <span className="tabular-nums text-neutral-100">{oracleLabel || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Pool</span>
                <span className="font-mono text-neutral-100">{shortAddr(market.marketAddress)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-800/60 p-2.5 text-xs">
              <span className="text-neutral-300">Risk</span>
              <span className="text-neutral-100">{formatLtv(market.ltvBps)} LTV</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
  );
}
