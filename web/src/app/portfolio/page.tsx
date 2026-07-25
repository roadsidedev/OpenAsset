"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useLoans } from "@/hooks/useLoans";
import { useMarkets } from "@/hooks/useMarkets";
import { LOAN_STATUS } from "@/lib/contractAbis";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Wallet,
  Briefcase,
  Layers,
  Clock,
  ExternalLink,
} from "lucide-react";

function formatAmount(value: string | undefined, decimals = 18): string {
  if (!value) return "0.00";
  try {
    const bigint = BigInt(value);
    const divisor = BigInt(10 ** decimals);
    const integerPart = bigint / divisor;
    const fractionalPart = bigint % divisor;
    const fracStr = fractionalPart.toString().padStart(decimals, "0").slice(0, 4);
    const trimmedFrac = fracStr.replace(/0+$/, "");
    const fracDisplay = trimmedFrac ? `.${trimmedFrac}` : "";
    return `${integerPart.toLocaleString()}${fracDisplay}`;
  } catch {
    return value;
  }
}

function timeUntil(timestampSec: string | number): string {
  const now = Date.now();
  const target = Number(timestampSec) * 1000;
  const diff = target - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { authenticated, ready } = usePrivy();
  const { login } = usePrivy();
  const isReady = ready !== false;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-10 w-40 bg-muted" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
          <p className="text-muted-foreground text-sm max-w-md">
            Connect your wallet to view your active loans and markets you&apos;ve created.
          </p>
          <button
            type="button"
            onClick={async () => { try { await login(); } catch (e) { console.error(e); } }}
            className="rounded-2xl bg-ice-300 text-slate-900 px-6 py-2.5 text-sm font-semibold hover:bg-ice-400 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

type PositionsTab = "loans" | "markets";

export default function PortfolioPage() {
  return (
    <AuthGate>
      <PortfolioContent />
    </AuthGate>
  );
}

function PortfolioContent() {
  const [tab, setTab] = useState<PositionsTab>("loans");
  const { address } = useAccount();

  const borrowerQueryEnabled = !!address && tab === "loans";
  const { data: loansData, isLoading: loansLoading } = useLoans(
    { borrower: address, status: "ACTIVE" },
    { enabled: borrowerQueryEnabled }
  );
  const { data: marketsData, isLoading: marketsLoading } = useMarkets(0, 100);

  const activeLoans: any[] = loansData?.loans || [];
  const allMarkets: any[] = marketsData?.markets || [];
  const myMarkets = address
    ? allMarkets.filter((m: any) => m.owner.toLowerCase() === address.toLowerCase())
    : [];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
            <p className="text-sm text-muted-foreground">
              Track active debt positions and markets you have launched
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted text-xs font-semibold">
            <button
              onClick={() => setTab("loans")}
              className={cn(
                "px-4 py-2 rounded-xl transition-all",
                tab === "loans"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              My Loans (Borrowed)
            </button>
            <button
              onClick={() => setTab("markets")}
              className={cn(
                "px-4 py-2 rounded-xl transition-all",
                tab === "markets"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              My Created Markets (LP)
            </button>
          </div>
        </div>

        {/* Tab: My Loans */}
        {tab === "loans" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="p-5 rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-ice-500" />
                  <span className="text-xs text-muted-foreground">Active Loans</span>
                </div>
                <span className="text-xl font-bold text-foreground">
                  {loansLoading ? <Skeleton className="h-7 w-12 bg-muted inline-block" /> : activeLoans.length}
                </span>
              </div>
              <div className="p-5 rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4 text-ice-500" />
                  <span className="text-xs text-muted-foreground">Total Borrowed</span>
                </div>
                <span className="text-xl font-bold text-foreground">
                  {loansLoading ? (
                    <Skeleton className="h-7 w-24 bg-muted inline-block" />
                  ) : (
                    `${formatAmount(activeLoans.reduce((s: bigint, l: any) => s + BigInt(l.principal || 0), BigInt(0)).toString())} USDC`
                  )}
                </span>
              </div>
              <div className="p-5 rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-ice-500" />
                  <span className="text-xs text-muted-foreground">Collateral Locked</span>
                </div>
                <span className="text-xl font-bold text-foreground">
                  {loansLoading ? (
                    <Skeleton className="h-7 w-24 bg-muted inline-block" />
                  ) : (
                    formatAmount(activeLoans.reduce((s: bigint, l: any) => s + BigInt(l.collateralAmount || 0), BigInt(0)).toString())
                  )}
                </span>
              </div>
              <div className="p-5 rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-ice-500" />
                  <span className="text-xs text-muted-foreground">Health Status</span>
                </div>
                <span className="text-xl font-bold text-emerald-500">
                  {loansLoading ? <Skeleton className="h-7 w-16 bg-muted inline-block" /> : "Healthy"}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card">
              <div className="border-b border-border px-6 py-4">
                <h3 className="font-bold text-sm">Active Loans</h3>
              </div>
              <div className="p-6">
                {loansLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-24 rounded-2xl bg-muted" />
                    ))}
                  </div>
                ) : activeLoans.length === 0 ? (
                  <div className="py-12 text-center">
                    <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm mb-2">No active loans found.</p>
                    <Link href="/markets" className="text-sm text-ice-500 hover:text-ice-600 font-medium">
                      Browse markets to borrow
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeLoans.map((loan: any) => (
                      <div
                        key={loan.address}
                        className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground">
                            {loan.marketAddress.slice(2, 6)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              Market {loan.marketAddress.slice(0, 8)}...
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {timeUntil(loan.expiryTime)} · {LOAN_STATUS[loan.status as keyof typeof LOAN_STATUS] || "Unknown"}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-medium text-foreground">{formatAmount(loan.principal)} USDC</p>
                          <p className="text-sm text-muted-foreground">Collateral: {formatAmount(loan.collateralAmount)}</p>
                        </div>
                        <Link
                          href={`/markets/${loan.marketAddress}`}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                        >
                          Manage <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: My Created Markets */}
        {tab === "markets" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="p-5 rounded-2xl border border-border bg-card">
                <span className="text-xs text-muted-foreground block mb-2">My Markets</span>
                <span className="text-xl font-bold text-foreground">
                  {marketsLoading ? <Skeleton className="h-7 w-12 bg-muted inline-block" /> : myMarkets.length}
                </span>
              </div>
              <div className="p-5 rounded-2xl border border-border bg-card">
                <span className="text-xs text-muted-foreground block mb-2">Total Liquidity</span>
                <span className="text-xl font-bold text-foreground">
                  {marketsLoading ? (
                    <Skeleton className="h-7 w-24 bg-muted inline-block" />
                  ) : (
                    `${formatAmount(myMarkets.reduce((s: bigint, m: any) => s + BigInt(m.liquidity?.available || 0), BigInt(0)).toString())} USDC`
                  )}
                </span>
              </div>
              <div className="p-5 rounded-2xl border border-border bg-card">
                <span className="text-xs text-muted-foreground block mb-2">Avg APR</span>
                <span className="text-xl font-bold text-ice-600 dark:text-ice-300">
                  {marketsLoading ? (
                    <Skeleton className="h-7 w-16 bg-muted inline-block" />
                  ) : myMarkets.length > 0
                    ? `${(myMarkets.reduce((s: number, m: any) => s + (m.aprBps || 0), 0) / myMarkets.length / 100).toFixed(2)}%`
                    : "0%"}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h3 className="font-bold text-sm">My Created Markets</h3>
                <Link href="/create-market" className="text-sm text-ice-500 hover:text-ice-600 font-medium">
                  + Create New
                </Link>
              </div>
              <div className="p-6">
                {marketsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 rounded-2xl bg-muted" />
                  </div>
                ) : myMarkets.length === 0 ? (
                  <div className="py-12 text-center">
                    <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm mb-2">You don&apos;t own any markets yet.</p>
                    <Link href="/create-market" className="text-sm text-ice-500 hover:text-ice-600 font-medium">
                      Create your first market
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myMarkets.map((market: any) => (
                      <div
                        key={market.marketAddress}
                        className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground">
                            {market.marketAddress.slice(2, 6)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              Market {market.marketAddress.slice(0, 8)}...
                            </p>
                            <p className="text-sm text-muted-foreground">
                              LTV: {(market.ltvBps / 100).toFixed(1)}% · APR: {(market.aprBps / 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-medium text-foreground">
                            {formatAmount(market.liquidity?.available)} USDC
                          </p>
                          <p className="text-sm text-muted-foreground">Available</p>
                        </div>
                        <Link
                          href={`/markets/${market.marketAddress}`}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                        >
                          View <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
