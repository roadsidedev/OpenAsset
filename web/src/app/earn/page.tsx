"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits, isAddress } from "viem";
import {
  MagnifyingGlass,
  TrendUp,
  Coins,
  ArrowSquareOut,
  WarningCircle,
  CirclesThreePlus,
} from "@phosphor-icons/react";
import { useMarkets, type Market } from "@/hooks/useMarkets";
import { useEnrichedMarkets } from "@/hooks/useEnrichedMarkets";
import { useLpPositions } from "@/hooks/useLpPositions";
import { DepositModal } from "@/components/modals/DepositModal";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenIcon } from "@/components/tokens/TokenPreview";
import { getChainLabel, getChainAccent } from "@/lib/chainLabels";
import { cn } from "@/lib/utils";

type SortKey = "apr" | "liquidity" | "newest";

function formatLiq(raw: string, decimals = 6): string {
  try {
    const n = Number(formatUnits(BigInt(raw || "0"), decimals));
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n === 0) return "$0";
    return `$${n.toFixed(2)}`;
  } catch {
    return "$0";
  }
}

function formatApr(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

function formatLtv(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

function formatDuration(seconds: number) {
  const days = Math.floor((seconds || 0) / 86400);
  if (days <= 0) return "<1d";
  return `${days}d`;
}

function utilizationPct(market: Market): number {
  try {
    const total = BigInt(market.liquidity?.total || "0");
    const reserved = BigInt(market.liquidity?.reserved || "0");
    if (total === 0n) return 0;
    return Number((reserved * 10000n) / total) / 100;
  } catch {
    return 0;
  }
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function EarnContent() {
  const searchParams = useSearchParams();
  const marketParam = searchParams.get("market") || "";
  const { address } = useAccount();
  const { data: marketsData, isLoading, isError, error, refetch } = useMarkets(0, 100);
  const allMarkets = marketsData?.markets ?? [];
  const { enriched } = useEnrichedMarkets(allMarkets);
  const { positions, totalClaimable, isLoading: lpLoading } = useLpPositions(address);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("apr");
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [selected, setSelected] = useState<Market | null>(null);

  const lpByMarket = useMemo(() => {
    const map = new Map<string, (typeof positions)[number]>();
    for (const p of positions) {
      map.set(p.market.marketAddress.toLowerCase(), p);
    }
    return map;
  }, [positions]);

  const openDeposit = useCallback((market: Market) => {
    setSelected(market);
    setDepositOpen(true);
  }, []);

  const openWithdraw = useCallback((market: Market) => {
    setSelected(market);
    setWithdrawOpen(true);
  }, []);

  // Deep link: /earn?market=0x…
  useEffect(() => {
    if (!marketParam || !isAddress(marketParam) || allMarkets.length === 0) return;
    const match = allMarkets.find(
      (m) => m.marketAddress.toLowerCase() === marketParam.toLowerCase() && m.active,
    );
    if (match) openDeposit(match);
  }, [marketParam, allMarkets, openDeposit]);

  const activeEnriched = useMemo(() => {
    let rows = enriched.filter((e) => e.market.active);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((e) => {
        const m = e.market;
        const hay = [
          e.identity?.displaySymbol,
          e.identity?.name,
          e.loanAssetSymbol,
          m.marketAddress,
          m.collateralAsset,
          m.loanAsset,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "apr") return (b.market.aprBps || 0) - (a.market.aprBps || 0);
      if (sort === "liquidity") {
        const la = BigInt(a.market.liquidity?.total || "0");
        const lb = BigInt(b.market.liquidity?.total || "0");
        return lb > la ? 1 : lb < la ? -1 : 0;
      }
      return (b.market.createdAt || 0) - (a.market.createdAt || 0);
    });
    return rows;
  }, [enriched, search, sort]);

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-[1160px] space-y-6 px-4 py-6 md:px-6 md:py-7">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendUp className="h-6 w-6 text-ice-500" />
            <h1 className="font-display text-[28px] leading-none tracking-[-0.025em] text-foreground md:text-[30px]">
              Earn
            </h1>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Supply liquidity to any active market. Yield comes from borrower interest, and each
            market is isolated — your deposit is never exposed to another market&apos;s collateral
            decisions.
          </p>
        </div>

        {address && (lpLoading || positions.length > 0) && (
          <div className="rounded-2xl border border-ice-500/20 bg-ice-500/5 p-4 md:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-ice-500" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Your LP positions</p>
                  <p className="text-xs text-muted-foreground">
                    {lpLoading
                      ? "Loading…"
                      : `${positions.length} market${positions.length === 1 ? "" : "s"} · claimable ≈ ${formatLiq(totalClaimable.toString())}`}
                  </p>
                </div>
              </div>
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-1 text-xs font-semibold text-ice-600 hover:underline dark:text-ice-300"
              >
                View in Portfolio <ArrowSquareOut className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search symbol or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
            />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 text-[13px] font-medium">
            {(
              [
                { id: "apr" as const, label: "Highest APR" },
                { id: "liquidity" as const, label: "Deepest liquidity" },
                { id: "newest" as const, label: "Newest" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSort(opt.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 transition-colors",
                  sort === opt.id
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Showing ACTIVE markets only
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl bg-muted md:h-24" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
            <WarningCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <p className="text-sm font-semibold text-foreground">Failed to load markets</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 rounded-2xl bg-ice-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-ice-400"
            >
              Retry
            </button>
          </div>
        ) : activeEnriched.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-14 text-center">
            <CirclesThreePlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No active markets to supply</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse the marketplace or create a market to get started.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/markets"
                className="rounded-2xl bg-ice-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-ice-400"
              >
                Browse markets
              </Link>
              <Link
                href="/create-market"
                className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
              >
                Create market
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile: market-card list — same anatomy as the live-market
                cards (icon header + network chip, 2x2 stats grid, action
                footer) so a market fits ~2 screens-worth less scroll. */}
            <div className="space-y-3 md:hidden">
              {activeEnriched.map(({ market, identity, loanAssetSymbol }) => {
                const sym =
                  identity?.displaySymbol ||
                  (market.collateralAsset
                    ? market.collateralAsset.slice(2, 6).toUpperCase()
                    : shortAddr(market.marketAddress));
                const name = identity?.name || "Unknown Asset";
                const categoryLabel = identity?.categoryLabel || "Tokens";
                const loanSym = loanAssetSymbol || "USDC";
                const util = utilizationPct(market);
                const lp = lpByMarket.get(market.marketAddress.toLowerCase());
                const hasLp = !!lp && lp.userShares > 0n;

                return (
                  <div
                    key={market.marketAddress}
                    className="rounded-2xl border border-border/70 bg-card p-4"
                  >
                    {/* Header: icon + identity + network chip */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <TokenIcon
                          symbol={sym}
                          logoUri={identity?.logoUri || null}
                          className="h-10 w-10 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/markets/${market.marketAddress}`}
                              className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground hover:underline"
                            >
                              {sym}
                            </Link>
                            <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                              {categoryLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[13px] font-medium leading-tight text-foreground">
                            {name}
                          </p>
                          <p className="mt-1 text-[11px] leading-none text-muted-foreground">
                            <span className="font-medium text-foreground">→ {loanSym}</span>
                            <span className="mx-1 opacity-40">·</span>
                            Util {util.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      {market.chainId ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2 py-1 text-[10px] font-medium leading-none text-muted-foreground"
                          title={`Market lives on ${getChainLabel(market.chainId)}`}
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: getChainAccent(market.chainId) }}
                            aria-hidden="true"
                          />
                          {getChainLabel(market.chainId)}
                        </span>
                      ) : null}
                    </div>

                    {/* Stats: compact 2x2 grid (MarketCard counterpart) */}
                    <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/40 p-3">
                      <div className="space-y-1">
                        <span className="block text-[11px] font-medium leading-none text-muted-foreground">Available</span>
                        <span className="block text-sm font-semibold leading-none text-foreground tabular-nums">
                          {formatLiq(market.liquidity?.available || "0")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="block text-[11px] font-medium leading-none text-muted-foreground">Supply APR</span>
                        <span className="block text-sm font-semibold leading-none tabular-nums text-ice-600 dark:text-ice-300">
                          {formatApr(market.aprBps)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="block text-[11px] font-medium leading-none text-muted-foreground">Max LTV</span>
                        <span className="block text-sm font-semibold leading-none text-foreground tabular-nums">
                          {formatLtv(market.ltvBps)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="block text-[11px] font-medium leading-none text-muted-foreground">Utilization</span>
                        <span className="block text-sm font-semibold leading-none text-foreground tabular-nums">
                          {util.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Footer: duration + actions */}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
                      <span className="text-muted-foreground">Duration · {formatDuration(market.durationSeconds)}</span>
                      <div className="flex items-center gap-2">
                        {hasLp && (
                          <button
                            type="button"
                            onClick={() => openWithdraw(market)}
                            className="rounded-xl border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-accent"
                          >
                            Withdraw
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openDeposit(market)}
                          className="rounded-xl bg-ice-300 px-3 py-1.5 text-[11px] font-bold text-slate-900 transition-colors hover:bg-ice-400 dark:bg-ice-400 dark:hover:bg-ice-300"
                        >
                          Supply
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: keep the columnar table */}
            <div className="hidden overflow-hidden rounded-3xl border border-border bg-card md:block">
              <div className="grid grid-cols-12 gap-3 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <div className="col-span-3">Collateral</div>
                <div className="col-span-2">Loan asset</div>
                <div className="col-span-2 text-right">Available</div>
                <div className="col-span-1 text-right">Util %</div>
                <div className="col-span-1 text-right">APR</div>
                <div className="col-span-1 text-right">LTV</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              <div className="divide-y divide-border">
                {activeEnriched.map(({ market, identity, loanAssetSymbol }) => {
                  const sym =
                    identity?.displaySymbol ||
                    (market.collateralAsset
                      ? market.collateralAsset.slice(2, 6).toUpperCase()
                      : shortAddr(market.marketAddress));
                  const name = identity?.name || "Unknown Asset";
                  const loanSym = loanAssetSymbol || "USDC";
                  const util = utilizationPct(market);
                  const lp = lpByMarket.get(market.marketAddress.toLowerCase());
                  const hasLp = !!lp && lp.userShares > 0n;

                  return (
                    <div
                      key={market.marketAddress}
                      className="grid grid-cols-12 items-center gap-3 px-5 py-4"
                    >
                      <div className="col-span-3 flex min-w-0 items-center gap-3">
                        <TokenIcon
                          symbol={sym}
                          logoUri={identity?.logoUri || null}
                          className="h-9 w-9 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/markets/${market.marketAddress}`}
                              className="truncate text-sm font-semibold text-foreground hover:underline"
                            >
                              {sym}
                            </Link>
                            {market.chainId ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                title={getChainLabel(market.chainId)}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: getChainAccent(market.chainId) }}
                                />
                                {getChainLabel(market.chainId)}
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{name}</p>
                        </div>
                      </div>

                      <div className="col-span-2 text-sm font-medium text-foreground">{loanSym}</div>

                      <div className="col-span-2 text-right text-sm font-semibold tabular-nums">
                        {formatLiq(market.liquidity?.available || "0")}
                      </div>

                      <div className="col-span-1 text-right text-sm tabular-nums">{util.toFixed(1)}%</div>

                      <div className="col-span-1 text-right text-sm font-semibold tabular-nums text-ice-600 dark:text-ice-300">
                        {formatApr(market.aprBps)}
                      </div>

                      <div className="col-span-1 text-right text-sm tabular-nums">{formatLtv(market.ltvBps)}</div>

                      <div className="col-span-2 flex flex-wrap justify-start gap-2 md:justify-end">
                        <button
                          type="button"
                          onClick={() => openDeposit(market)}
                          className="rounded-xl bg-ice-300 px-3.5 py-2 text-xs font-bold text-slate-900 transition-colors hover:bg-ice-400 dark:bg-ice-400 dark:hover:bg-ice-300"
                        >
                          Supply
                        </button>
                        {hasLp && (
                          <button
                            type="button"
                            onClick={() => openWithdraw(market)}
                            className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-accent"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Looking for more markets?{" "}
          <Link href="/markets" className="font-semibold text-ice-600 hover:underline dark:text-ice-300">
            Browse all markets
          </Link>
        </p>
      </main>

      <DepositModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        marketAddress={selected?.marketAddress}
        chainId={selected?.chainId}
        lendingAsset={selected?.loanAsset}
        lendingSymbol="USDC"
        lendingDecimals={6}
      />
      <WithdrawModal
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        marketAddress={selected?.marketAddress}
        chainId={selected?.chainId}
        lendingAsset={selected?.loanAsset}
        lendingSymbol="USDC"
        lendingDecimals={6}
      />
    </div>
  );
}

export default function EarnPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1160px] space-y-4 px-4 py-6">
          <Skeleton className="h-10 w-48 bg-muted" />
          <Skeleton className="h-24 w-full rounded-2xl bg-muted" />
          <Skeleton className="h-64 w-full rounded-3xl bg-muted" />
        </div>
      }
    >
      <EarnContent />
    </Suspense>
  );
}
