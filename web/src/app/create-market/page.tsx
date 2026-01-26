"use client";

import Link from "next/link";
import { useMarketStore } from "@/store/useMarketStore";

export default function CreateMarketPage() {
  const { step, formData, setStep, setFormData } = useMarketStore();

  const handleNext = () => setStep(Math.min(step + 1, 4));
  const handleBack = () => setStep(Math.max(step - 1, 1));

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="container mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Launch New Market</h1>
          <p className="mt-2 text-zinc-400">Step {step} of 4</p>
          <div className="mt-4 h-1 w-full rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-red-600 transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Asset Selection</h2>
              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Collateral Asset Address (ERC20)
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-white placeholder-zinc-600 focus:border-red-500 focus:outline-none"
                  value={formData.assetAddress}
                  onChange={(e) =>
                    setFormData({ assetAddress: e.target.value })
                  }
                />
              </div>
              <div className="rounded-lg bg-zinc-800 p-4">
                <p className="text-sm text-zinc-400">Detected Asset:</p>
                <p className="font-semibold">GameToken (GAME)</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Loan Terms</h2>
              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Loan-to-Value (LTV): {formData.ltv}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="90"
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-red-500"
                  value={formData.ltv}
                  onChange={(e) =>
                    setFormData({ ltv: Number(e.target.value) })
                  }
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Borrowers can borrow ${formData.ltv} for every $100 of collateral.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Annual Interest Rate (APR)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-white focus:border-red-500 focus:outline-none"
                    value={formData.apr}
                    onChange={(e) =>
                      setFormData({ apr: Number(e.target.value) })
                    }
                  />
                  <span className="absolute right-4 top-3 text-zinc-500">%</span>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Loan Duration
                </label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-white focus:border-red-500 focus:outline-none"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ duration: Number(e.target.value) })
                  }
                >
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Risk Controls</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 p-4">
                  <div>
                    <h3 className="font-medium">Circuit Breaker</h3>
                    <p className="text-xs text-zinc-500">
                      Pause new loans if price drops {">"}20% in 6h.
                    </p>
                  </div>
                  <div className="h-6 w-11 rounded-full bg-red-600 p-1">
                    <div className="h-4 w-4 rounded-full bg-white shadow-sm translate-x-5"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 p-4">
                  <div>
                    <h3 className="font-medium">Oracle</h3>
                    <p className="text-xs text-zinc-500">
                      Uniswap V3 TWAP (30 min)
                    </p>
                  </div>
                  <span className="text-sm text-green-400">Active</span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Initial Liquidity</h2>
              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Deposit Amount (USDC)
                </label>
                <input
                  type="number"
                  placeholder="1000"
                  className="w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-white focus:border-red-500 focus:outline-none"
                  value={formData.liquidity}
                  onChange={(e) =>
                    setFormData({ liquidity: e.target.value })
                  }
                />
              </div>
              <div className="rounded-lg bg-zinc-800 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Creation Fee (1%)</span>
                  <span>
                    {(Number(formData.liquidity) * 0.01).toFixed(2)} USDC
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-white/10 pt-2">
                  <span>Total Cost</span>
                  <span>
                    {(Number(formData.liquidity) * 1.01).toFixed(2)} USDC
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex gap-4">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex-1 rounded-lg border border-white/10 py-3 font-semibold transition hover:bg-white/5"
              >
                Back
              </button>
            )}
            <button
              onClick={step === 4 ? () => alert("Market Deployed!") : handleNext}
              className="flex-1 rounded-lg bg-red-600 py-3 font-semibold transition hover:bg-red-500"
            >
              {step === 4 ? "Deploy Market" : "Continue"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}