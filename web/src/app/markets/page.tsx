"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MarketCardSkeleton } from "@/components/skeletons/MarketCardSkeleton";

// Mock Data
const MOCK_MARKETS = [
  {
    id: 1,
    asset: "GAME",
    name: "GameToken",
    ltv: 75,
    apr: 12,
    duration: 30,
    liquidity: "50,000",
    liquiditySymbol: "USDC",
    icon: "🎮",
  },
  {
    id: 2,
    asset: "PEPE",
    name: "Pepe Coin",
    ltv: 50,
    apr: 25,
    duration: 14,
    liquidity: "12,500",
    liquiditySymbol: "ETH",
    icon: "🐸",
  },
  {
    id: 3,
    asset: "NFT-X",
    name: "Cool Cats",
    ltv: 60,
    apr: 15,
    duration: 90,
    liquidity: "100,000",
    liquiditySymbol: "USDC",
    icon: "🐱",
  },
];

export default function MarketsPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate network delay
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white pb-20 md:pb-0">
      <main className="container mx-auto px-6 py-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold">Lending Markets</h1>
            <p className="mt-2 text-zinc-400">
              Browse active markets or create your own to earn yield.
            </p>
          </div>
          <Link
            href="/create-market"
            className="rounded-full bg-red-600 px-6 py-3 font-semibold transition hover:bg-red-500 text-center"
          >
            + Create Market
          </Link>
        </div>

        {/* Filters (Mock) */}
        <div className="mt-8 flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          <button className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors">
            All Assets
          </button>
          <button className="whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/10 text-zinc-400 transition-colors">
            Gaming
          </button>
          <button className="whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/10 text-zinc-400 transition-colors">
            Memes
          </button>
          <button className="whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/10 text-zinc-400 transition-colors">
            NFTs
          </button>
        </div>

        {/* Market Grid */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <MarketCardSkeleton key={i} />
              ))
            : MOCK_MARKETS.map((market) => (
                <div
                  key={market.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 p-6 transition hover:border-red-500/50 hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-xl">
                        {market.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold">{market.name}</h3>
                        <p className="text-xs text-zinc-500">{market.asset}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs text-green-400">
                      Active
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
                    <div>
                      <p className="text-xs text-zinc-500">LTV</p>
                      <p className="text-lg font-medium">{market.ltv}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">APR</p>
                      <p className="text-lg font-medium text-green-400">
                        {market.apr}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Duration</p>
                      <p className="text-lg font-medium">{market.duration} Days</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Liquidity</p>
                      <p className="text-lg font-medium">
                        {market.liquidity} <span className="text-xs text-zinc-500">{market.liquiditySymbol}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Link
                      href={`/borrow/${market.id}`}
                      className="flex-1 rounded-lg bg-white py-2.5 text-center text-sm font-semibold text-black transition hover:bg-zinc-200"
                    >
                      Borrow
                    </Link>
                    <button className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm font-semibold transition hover:bg-white/5">
                      Supply
                    </button>
                  </div>
                </div>
              ))}
        </div>
      </main>
    </div>
  );
}