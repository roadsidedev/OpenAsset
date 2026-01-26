"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoanRequestPage({ params }: { params: { marketId: string } }) {
  const [collateralAmount, setCollateralAmount] = useState("");
  const [isApproved, setIsApproved] = useState(false);

  // Mock Market Data (in real app, fetch by ID)
  const market = {
    id: params.marketId,
    name: "GameToken Market",
    asset: "GAME",
    price: 0.25,
    ltv: 75,
    apr: 12,
    duration: 30,
    liquidity: 50000,
  };

  const collateralValue = Number(collateralAmount) * market.price;
  const maxLoan = (collateralValue * market.ltv) / 100;
  const interest = (maxLoan * market.apr * market.duration) / (365 * 100);
  const totalRepayment = maxLoan + interest;

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="container mx-auto max-w-lg px-6 py-12">
        <div className="mb-8">
          <Link href="/markets" className="mb-4 inline-block text-sm text-zinc-400 hover:text-white">
            ← Back to Markets
          </Link>
          <h1 className="text-3xl font-bold">Request Loan</h1>
          <p className="mt-2 text-zinc-400">
            Borrow USDC against your {market.name}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-8">
          <div className="mb-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Deposit Collateral ({market.asset})
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-white focus:border-red-500 focus:outline-none"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                />
                <button
                  className="absolute right-3 top-2.5 text-xs text-red-400 hover:text-red-300"
                  onClick={() => setCollateralAmount("1000")}
                >
                  MAX
                </button>
              </div>
              <div className="mt-2 flex justify-between text-xs text-zinc-500">
                <span>Balance: 1,500 {market.asset}</span>
                <span>Value: ${collateralValue.toFixed(2)}</span>
              </div>
            </div>

            <div className="rounded-xl bg-zinc-800/50 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Max Loan (LTV {market.ltv}%)</span>
                <span className="font-semibold text-white">
                  ${maxLoan.toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Interest ({market.apr}%)</span>
                <span>${interest.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Duration</span>
                <span>{market.duration} Days</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                <span>Total Repayment</span>
                <span>${totalRepayment.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {!isApproved ? (
            <button
              onClick={() => setIsApproved(true)}
              className="w-full rounded-lg bg-zinc-100 py-3 font-semibold text-black transition hover:bg-white"
              disabled={!collateralAmount}
            >
              Approve {market.asset}
            </button>
          ) : (
            <button
              onClick={() => alert("Loan Requested!")}
              className="w-full rounded-lg bg-red-600 py-3 font-semibold transition hover:bg-red-500"
            >
              Confirm Loan
            </button>
          )}
          
          <p className="mt-4 text-center text-xs text-zinc-500">
            Liquidation Price: ${(market.price * 0.8).toFixed(4)} (-20%)
          </p>
        </div>
      </main>
    </div>
  );
}