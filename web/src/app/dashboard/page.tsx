"use client";

import { useState } from "react";
import Link from "next/link";

export default function DashboardPage() {
  const [tab, setTab] = useState<"borrower" | "lp">("borrower");

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
            {/* Health Stats */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Total Borrowed</p>
                <p className="text-2xl font-bold">$1,250.00</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Collateral Value</p>
                <p className="text-2xl font-bold">$2,100.00</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Avg. Health Factor</p>
                <p className="text-2xl font-bold text-green-400">1.68</p>
              </div>
            </div>

            {/* Active Loans */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50">
              <div className="border-b border-white/10 px-6 py-4">
                <h3 className="font-semibold">Active Loans</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800">
                          🎮
                        </div>
                        <div>
                          <p className="font-medium">GameToken Market</p>
                          <p className="text-sm text-zinc-500">
                            Due in 14 days
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">$750.00</p>
                        <p className="text-sm text-green-400">Health: 1.45</p>
                      </div>
                      <button className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5">
                        Manage
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* LP Stats */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Total Liquidity</p>
                <p className="text-2xl font-bold">$50,000.00</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Active Loans</p>
                <p className="text-2xl font-bold">12</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-400">Est. APY</p>
                <p className="text-2xl font-bold text-green-400">14.2%</p>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800">
                        🐸
                      </div>
                      <div>
                        <p className="font-medium">Pepe Coin Market</p>
                        <p className="text-sm text-zinc-500">
                          Util: 45% • LTV: 50%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">$12,500</p>
                      <p className="text-sm text-zinc-500">Liquidity</p>
                    </div>
                    <button className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5">
                      Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}