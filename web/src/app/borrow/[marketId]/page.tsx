"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useMarket } from "@/hooks/useMarkets";
import { useContractInteraction } from "@/hooks/useContractInteraction";

export default function BorrowPage({ params }: { params: { marketId: string } }) {
  const router = useRouter();
  const { address: userAddress } = useAccount();
  const { data: market, isLoading, error } = useMarket(params.marketId);
  const { requestLoan, isLoading: isTxLoading, error: txError } = useContractInteraction();
  
  const [collateralAmount, setCollateralAmount] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  const calculateMaxBorrow = () => {
    if (!market || !collateralAmount) return "0";
    const collateral = parseFloat(collateralAmount);
    const ltv = market.ltvBps / 10000;
    return (collateral * ltv).toFixed(6);
  };

  const handleRequestLoan = async () => {
    if (!userAddress) {
      alert("Please connect your wallet");
      return;
    }

    if (!market) {
      alert("Market data not loaded");
      return;
    }

    try {
      const maxBorrow = parseFloat(calculateMaxBorrow());
      const principal = parseFloat(principalAmount);

      if (principal > maxBorrow) {
        alert(`Principal amount exceeds maximum borrow of ${maxBorrow.toFixed(6)}`);
        return;
      }

      const result = await requestLoan(market.marketAddress, {
        collateralAmount,
        tokenId: 0,
        erc1155Amount: "0",
        desiredPrincipal: principalAmount,
      });

      setTxHash(result.txHash);
      setTimeout(() => {
        router.push("/markets");
      }, 2000);
    } catch (err) {
      console.error("Loan request failed:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-zinc-400">Loading market details...</div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-red-400">Market not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="container mx-auto max-w-2xl px-6 py-12">
        <button
          onClick={() => router.back()}
          className="mb-6 text-zinc-400 hover:text-white transition"
        >
          ← Back
        </button>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-8">
          <h1 className="text-3xl font-bold mb-2">Borrow from Market</h1>
          <p className="text-zinc-400 mb-8">
            Market: {market.marketAddress.slice(0, 10)}...
          </p>

          {txError && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/50 p-4 text-red-400">
              {txError.message}
            </div>
          )}

          {txHash && (
            <div className="mb-6 rounded-lg bg-green-500/10 border border-green-500/50 p-4 text-green-400">
              Loan requested successfully! Tx: {txHash.slice(0, 10)}...
            </div>
          )}

          <div className="space-y-6">
            {/* Market Stats */}
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-black/40 p-6 border border-white/5">
              <div>
                <p className="text-xs text-zinc-500">LTV</p>
                <p className="text-2xl font-bold">{(market.ltvBps / 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">APR</p>
                <p className="text-2xl font-bold text-green-400">{(market.aprBps / 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Duration</p>
                <p className="text-lg font-bold">{Math.floor(market.durationSeconds / 86400)} Days</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Available Liquidity</p>
                <p className="text-lg font-bold">{parseFloat(market.liquidity.available).toFixed(2)}</p>
              </div>
            </div>

            {/* Collateral Input */}
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Collateral Amount (Tokens)
              </label>
              <input
                type="number"
                placeholder="Enter collateral amount"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-white placeholder-zinc-600 focus:border-red-500 focus:outline-none"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Collateral Asset: {market.collateralAsset.slice(0, 10)}...
              </p>
            </div>

            {/* Max Borrow Display */}
            {collateralAmount && (
              <div className="rounded-lg bg-zinc-800 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Maximum Borrow:</span>
                  <span className="text-lg font-semibold">{calculateMaxBorrow()}</span>
                </div>
              </div>
            )}

            {/* Principal Input */}
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Desired Principal (Loan Amount)
              </label>
              <input
                type="number"
                placeholder="Enter loan amount"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-white placeholder-zinc-600 focus:border-red-500 focus:outline-none"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Loan Asset: {market.loanAsset.slice(0, 10)}...
              </p>
            </div>

            {/* Loan Summary */}
            {principalAmount && (
              <div className="rounded-lg bg-zinc-800 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Principal:</span>
                  <span>{parseFloat(principalAmount).toFixed(6)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Interest (30 days):</span>
                  <span>
                    {(
                      (parseFloat(principalAmount) * (market.aprBps / 10000) * 30) /
                      365
                    ).toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                  <span className="text-zinc-400">Total Repayment:</span>
                  <span className="font-semibold">
                    {(
                      parseFloat(principalAmount) +
                      (parseFloat(principalAmount) * (market.aprBps / 10000) * 30) /
                        365
                    ).toFixed(6)}
                  </span>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleRequestLoan}
              disabled={isTxLoading || !collateralAmount || !principalAmount || !userAddress}
              className="w-full rounded-lg bg-red-600 py-4 font-semibold transition hover:bg-red-500 disabled:opacity-50"
            >
              {isTxLoading ? "Processing..." : !userAddress ? "Connect Wallet" : "Request Loan"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
