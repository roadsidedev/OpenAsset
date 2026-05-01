"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useLoans } from "@/hooks/useLoans";
import { useMarkets } from "@/hooks/useMarkets";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function DashboardPage() {
  const [tab, setTab] = useState<"borrower" | "lp">("borrower");
  const { user, authenticated, ready: privyReady } = usePrivy();
  const address = user?.wallet?.address;

  const borrowerQueryEnabled = !!address && tab === "borrower";

  const { data: loansData, isLoading: loansLoading } = useLoans(
    { borrower: address, status: "ACTIVE" },
    { enabled: borrowerQueryEnabled }
  );

  const { data: marketsData, isLoading: marketsLoading } = useMarkets(0, 100);

  const activeLoans = loansData?.loans || [];
  const allMarkets = marketsData?.markets || [];
  const myMarkets = address
    ? allMarkets.filter(
        (m) => m.owner.toLowerCase() === address.toLowerCase()
      )
    : [];

  // Borrower stats
  const totalBorrowed = activeLoans.reduce(
    (sum, loan) => sum + BigInt(loan.principal || 0),
    BigInt(0)
  );
  const totalCollateral = activeLoans.reduce(
    (sum, loan) => sum + BigInt(loan.collateralAmount || 0),
    BigInt(0)
  );

  // LP stats
  const totalLiquidity = myMarkets.reduce(
    (sum, m) => sum + BigInt(m.liquidity?.available || 0),
    BigInt(0)
  );
  const avgAprBps =
    myMarkets.length > 0
      ? myMarkets.reduce((sum, m) => sum + (m.aprBps || 0), 0) /
        myMarkets.length
      : 0;

  if (!privyReady) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="container mx-auto px-6 py-12">
          <Skeleton className="h-10 w-48 bg-zinc-800" />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Skeleton className="h-32 rounded-2xl bg-zinc-800" />
            <Skeleton className="h-32 rounded-2xl bg-zinc-800" />
            <Skeleton className="h-32 rounded-2xl bg-zinc-800" />
          </div>
        </main>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="container mx-auto px-6 py-12 text-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-4 text-zinc-400">
            Connect your wallet to view your loans and markets.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="container mx-auto px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex rounded-lg bg-zinc-900 p-1">
            <button
              onClick={() => setTab("borrower")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                tab === "borrower"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              My Loans
            </button>
            <button
              onClick={() => setTab("lp")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                tab === "lp"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              My Markets
            </button>
          </div>
        </div>

        {tab === "borrower" ? (
          <div className="space-y-6">
            {/* Borrower Stats */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Total Borrowed</p>
                <p className="text-2xl font-bold">
                  {loansLoading ? (
                    <Skeleton className="mt-2 h-8 w-32 bg-zinc-800" />
                  ) : (
                    `${formatAmount(totalBorrowed.toString())} USDC`
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Collateral Value</p>
                <p className="text-2xl font-bold">
                  {loansLoading ? (
                    <Skeleton className="mt-2 h-8 w-32 bg-zinc-800" />
                  ) : (
                    `${formatAmount(totalCollateral.toString())}`
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Active Loans</p>
                <p className="text-2xl font-bold text-green-400">
                  {loansLoading ? (
                    <Skeleton className="mt-2 h-8 w-16 bg-zinc-800" />
                  ) : (
                    activeLoans.length
                  )}
                </p>
              </div>
            </div>

            {/* Active Loans */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50">
              <div className="border-b border-white/10 px-6 py-4">
                <h3 className="font-semibold">Active Loans</h3>
              </div>
              <div className="p-6">
                {loansLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <Skeleton
                        key={i}
                        className="h-20 rounded-xl bg-zinc-800"
                      />
                    ))}
                  </div>
                ) : activeLoans.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500">
                    <p>No active loans found.</p>
                    <Link
                      href="/markets"
                      className="mt-2 inline-block text-sm text-red-400 hover:text-red-300"
                    >
                      Browse markets to borrow
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeLoans.map((loan) => (
                      <div
                        key={loan.address}
                        className="flex flex-col gap-4 rounded-xl border border-white/5 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-mono text-zinc-400">
                            {loan.marketAddress.slice(0, 4)}
                          </div>
                          <div>
                            <p className="font-medium">
                              Market {loan.marketAddress.slice(0, 6)}…
                              {loan.marketAddress.slice(-4)}
                            </p>
                            <p className="text-sm text-zinc-500">
                              {timeUntil(loan.expiryTime)}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-medium">
                            {formatAmount(loan.principal)} USDC
                          </p>
                          <p className="text-sm text-zinc-500">
                            Collateral: {formatAmount(loan.collateralAmount)}
                          </p>
                        </div>
                        <Link
                          href={`/borrow/${loan.marketAddress}`}
                          className="inline-block rounded-lg border border-white/10 px-4 py-2 text-center text-sm font-medium hover:bg-white/5"
                        >
                          Manage
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* LP Stats */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Available Liquidity</p>
                <p className="text-2xl font-bold">
                  {marketsLoading ? (
                    <Skeleton className="mt-2 h-8 w-32 bg-zinc-800" />
                  ) : (
                    `${formatAmount(totalLiquidity.toString())} USDC`
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">My Markets</p>
                <p className="text-2xl font-bold">
                  {marketsLoading ? (
                    <Skeleton className="mt-2 h-8 w-16 bg-zinc-800" />
                  ) : (
                    myMarkets.length
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Avg. APR</p>
                <p className="text-2xl font-bold text-green-400">
                  {marketsLoading ? (
                    <Skeleton className="mt-2 h-8 w-16 bg-zinc-800" />
                  ) : (
                    `${(avgAprBps / 100).toFixed(2)}%`
                  )}
                </p>
              </div>
            </div>

            {/* My Markets */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <h3 className="font-semibold">My Markets</h3>
                <Link
                  href="/create-market"
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  + Create New
                </Link>
              </div>
              <div className="p-6">
                {marketsLoading ? (
                  <div className="space-y-4">
                    {[1].map((i) => (
                      <Skeleton
                        key={i}
                        className="h-20 rounded-xl bg-zinc-800"
                      />
                    ))}
                  </div>
                ) : myMarkets.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500">
                    <p>You don&apos;t own any markets yet.</p>
                    <Link
                      href="/create-market"
                      className="mt-2 inline-block text-sm text-red-400 hover:text-red-300"
                    >
                      Create your first market
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myMarkets.map((market) => (
                      <div
                        key={market.marketAddress}
                        className="flex flex-col gap-4 rounded-xl border border-white/5 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-mono text-zinc-400">
                            {market.marketAddress.slice(0, 4)}
                          </div>
                          <div>
                            <p className="font-medium">
                              Market {market.marketAddress.slice(0, 6)}…
                              {market.marketAddress.slice(-4)}
                            </p>
                            <p className="text-sm text-zinc-500">
                              LTV: {(market.ltvBps / 100).toFixed(1)}% • APR:{" "}
                              {(market.aprBps / 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-medium">
                            {formatAmount(market.liquidity?.available)} USDC
                          </p>
                          <p className="text-sm text-zinc-500">Available</p>
                        </div>
                        <Link
                          href={`/markets/${market.marketAddress}`}
                          className="inline-block rounded-lg border border-white/10 px-4 py-2 text-center text-sm font-medium hover:bg-white/5"
                        >
                          Settings
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
