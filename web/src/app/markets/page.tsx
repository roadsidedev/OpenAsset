"use client";

import { useState } from "react";
import Link from "next/link";
import { useMarkets } from "@/hooks/useMarkets";
import { MarketCardSkeleton } from "@/components/skeletons/MarketCardSkeleton";

export default function MarketsPage() {
  const [start, setStart] = useState(0);
  const [filter, setFilter] = useState<"all" | "gaming" | "memes" | "nft">("all");
  const { data, isLoading, error } = useMarkets(start, 20);

  return (
    <div className="min-h-screen bg-black text-white pb-20 md:pb-0">
      <main className="container mx-auto px-6 py-12">
        <div>
          <h1 className="text-3xl font-bold">Lending Markets</h1>
          <p className="mt-2 text-zinc-400">
            Browse active markets or create your own to earn yield.
          </p>
        </div>

        {/* Filters */}
        <div className="mt-8 flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {(["all", "gaming", "memes", "nft"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                filter === type
                  ? "border-red-500 bg-red-500/10"
                  : "border-white/10 text-zinc-400 hover:bg-white/10"
              }`}
            >
              {type === "all" ? "All Assets" : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Market Grid */}
        {error && (
          <div className="mt-8 rounded-lg bg-red-500/10 border border-red-500/50 p-4 text-red-400">
            Error loading markets: {error.message}
          </div>
        )}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <MarketCardSkeleton key={i} />
              ))
            : data?.markets && data.markets.length > 0
            ? data.markets.map((market: any) => (
                <div
                  key={market.marketAddress}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 p-6 transition hover:border-red-500/50 hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-xl">
                        💼
                      </div>
                      <div>
                        <h3 className="font-semibold">Market {market.marketAddress.slice(0, 6)}</h3>
                        <p className="text-xs text-zinc-500">{market.collateralAsset.slice(0, 8)}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${
                      market.active
                        ? "bg-green-500/10 text-green-400"
                        : "bg-zinc-500/10 text-zinc-400"
                    }`}>
                      {market.active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
                    <div>
                      <p className="text-xs text-zinc-500">LTV</p>
                      <p className="text-lg font-medium">{(market.ltvBps / 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">APR</p>
                      <p className="text-lg font-medium text-green-400">
                        {(market.aprBps / 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Duration</p>
                      <p className="text-lg font-medium">{Math.floor(market.durationSeconds / 86400)} Days</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Liquidity</p>
                      <p className="text-lg font-medium text-sm">
                        {parseFloat(market.liquidity.available).toFixed(2)} <span className="text-xs text-zinc-500">USDC</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Link
                      href={`/borrow/${market.marketAddress}`}
                      className="flex-1 rounded-lg bg-white py-2.5 text-center text-sm font-semibold text-black transition hover:bg-zinc-200"
                    >
                      Borrow
                    </Link>
                    <button className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm font-semibold transition hover:bg-white/5">
                      Supply
                    </button>
                  </div>
                </div>
              ))
            : (
              <div className="col-span-full text-center py-12">
                <p className="text-zinc-400">No markets found</p>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}