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
import { DepositModal } from "@/components/modals/DepositModal";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Wallet,
  TrendingUp,
  Layers,
  Shield,
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

type Tab = "loans" | "markets" | "config" | "transactions" | "settings";

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("loans");
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { user, authenticated, ready: privyReady } = usePrivy();
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

  const totalBorrowed = activeLoans.reduce((sum: bigint, l: any) => sum + BigInt(l.principal || 0), BigInt(0));
  const totalCollateral = activeLoans.reduce((sum: bigint, l: any) => sum + BigInt(l.collateralAmount || 0), BigInt(0));
  const totalLiquidity = myMarkets.reduce((sum: bigint, m: any) => sum + BigInt(m.liquidity?.available || 0), BigInt(0));

  const TABS: { id: Tab; label: string }[] = [
    { id: "loans", label: "My Loans" },
    { id: "markets", label: "My Markets" },
  ];

  const SUB_TABS: { id: Tab; label: string }[] = [
    { id: "config", label: "Config & Rules" },
    { id: "transactions", label: "Transactions" },
    { id: "settings", label: "Settings" },
  ];

  if (!privyReady) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-6">
          <Skeleton className="h-32 rounded-3xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl bg-muted" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Connect your wallet to view your loans and markets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-8">
        {/* Account Header */}
        <div className="p-6 md:p-8 rounded-3xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-ice-100 dark:bg-ice-900/40 text-ice-600 dark:text-ice-300 flex items-center justify-center font-extrabold text-xl">
              oA
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">
                  {user?.email?.address || "Account"}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                  Connected
                </span>
              </div>
              <div className="text-xs font-mono text-muted-foreground mt-1 flex items-center gap-2">
                <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(address || "")}
                  title="Copy Address"
                  className="hover:text-foreground transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDepositOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white transition-colors"
            >
              <ArrowDownLeft className="h-4 w-4" /> Deposit
            </button>
            <button
              onClick={() => setWithdrawOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-border text-xs font-semibold hover:bg-accent transition-colors"
            >
              <ArrowUpRight className="h-4 w-4" /> Withdraw
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-ice-500" />
              <span className="text-xs text-muted-foreground">Total Borrowed</span>
            </div>
            <span className="text-xl font-bold text-foreground">
              {loansLoading ? <Skeleton className="h-7 w-24 bg-muted inline-block" /> : `${formatAmount(totalBorrowed.toString())} USDC`}
            </span>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-ice-500" />
              <span className="text-xs text-muted-foreground">Collateral Value</span>
            </div>
            <span className="text-xl font-bold text-foreground">
              {loansLoading ? <Skeleton className="h-7 w-24 bg-muted inline-block" /> : formatAmount(totalCollateral.toString())}
            </span>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-ice-500" />
              <span className="text-xs text-muted-foreground">Active Loans</span>
            </div>
            <span className="text-xl font-bold text-ice-600 dark:text-ice-300">
              {loansLoading ? <Skeleton className="h-7 w-12 bg-muted inline-block" /> : activeLoans.length}
            </span>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-ice-500" />
              <span className="text-xs text-muted-foreground">My Markets</span>
            </div>
            <span className="text-xl font-bold text-foreground">
              {marketsLoading ? <Skeleton className="h-7 w-12 bg-muted inline-block" /> : myMarkets.length}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted text-xs font-semibold overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 rounded-xl transition-all whitespace-nowrap",
                tab === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "loans" && (
          <div className="space-y-4">
            {loansLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl bg-muted" />
                ))}
              </div>
            ) : activeLoans.length === 0 ? (
              <div className="text-center py-16 rounded-3xl border border-border bg-card">
                <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-sm mb-2">No active loans found.</p>
                <Link href="/markets" className="text-sm text-ice-500 hover:text-ice-600 font-medium">
                  Browse markets to borrow
                </Link>
              </div>
            ) : (
              activeLoans.map((loan) => (
                <div
                  key={loan.address}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
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
              ))
            )}
          </div>
        )}

        {tab === "markets" && (
          <div className="space-y-4">
            {marketsLoading ? (
              <div className="space-y-4">
                {[1].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl bg-muted" />
                ))}
              </div>
            ) : myMarkets.length === 0 ? (
              <div className="text-center py-16 rounded-3xl border border-border bg-card">
                <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-sm mb-2">You don&apos;t own any markets yet.</p>
                <Link href="/create-market" className="text-sm text-ice-500 hover:text-ice-600 font-medium">
                  Create your first market
                </Link>
              </div>
            ) : (
              myMarkets.map((market) => (
                <div
                  key={market.marketAddress}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
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
              ))
            )}
          </div>
        )}

        {/* Sub-tabs for config/transactions/settings */}
        {tab === "loans" && activeLoans.length > 0 && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto text-xs font-semibold">
              {SUB_TABS.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setTab(st.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl transition-all whitespace-nowrap",
                    tab === st.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Config Tab */}
        {tab === "config" && (
          <div className="p-6 rounded-3xl border border-border bg-card space-y-4 max-w-2xl">
            <h3 className="text-sm font-bold text-foreground">Risk Management & Configuration</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/50">
                <div>
                  <div className="font-bold text-foreground">Auto-Apply LP Earnings</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Automatically direct pool yields towards active loan debt
                  </div>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-ice-500 rounded" />
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/50">
                <div>
                  <div className="font-bold text-foreground">Circuit Breaker Alerts</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Instant notifications when pricing feeds halt or reset
                  </div>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-ice-500 rounded" />
              </div>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {tab === "transactions" && (
          <div className="p-6 rounded-3xl border border-border bg-card space-y-4">
            <h3 className="text-sm font-bold text-foreground">On-Chain Activity</h3>
            <div className="text-center py-8 text-muted-foreground text-xs">
              Transaction history will appear here once you have activity.
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === "settings" && (
          <div className="p-6 rounded-3xl border border-border bg-card space-y-6 max-w-xl">
            <h3 className="text-sm font-bold text-foreground">Wallet & Security</h3>
            <p className="text-xs text-muted-foreground">
              Manage your wallet connection and export settings.
            </p>
            <div className="space-y-3">
              <button className="w-full px-4 py-2.5 rounded-2xl border border-border text-xs font-semibold hover:bg-accent transition-colors text-left">
                Disconnect Wallet
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <DepositModal open={depositOpen} onOpenChange={setDepositOpen} />
      <WithdrawModal open={withdrawOpen} onOpenChange={setWithdrawOpen} />
    </div>
  );
}
