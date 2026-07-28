"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { usePublicClient, useWalletClient } from "wagmi";
import { type Address, parseAbi } from "viem";
import { LENDING_MARKET_ABI } from "@/lib/contractAbis";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Warning } from "@phosphor-icons/react";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WithdrawModal({ open, onOpenChange }: WithdrawModalProps) {
  const params = useParams();
  const marketId = params.marketId as string;
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleWithdraw = useCallback(async () => {
    if (!amount || !marketId || !walletClient || !publicClient) return;
    setIsWithdrawing(true);
    setError(null);
    try {
      const hash = await walletClient.writeContract({
        address: marketId as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: 'withdrawLiquidity',
        args: [BigInt(parseFloat(amount) * 1e6)], // USDC 6 decimals
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setTxHash(receipt.transactionHash);
      setTimeout(() => {
        setAmount("");
        setTxHash(null);
        onOpenChange(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  }, [amount, marketId, walletClient, publicClient, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Withdraw Liquidity</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Withdraw your deposited stablecoins from the protocol.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Amount (USDC)</label>
            <input
              type="number"
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <Warning className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {txHash && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              Withdrawn! Tx: {txHash.slice(0, 10)}...
            </div>
          )}

          <button
            onClick={handleWithdraw}
            disabled={!amount || isWithdrawing}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isWithdrawing ? "Withdrawing..." : "Confirm Withdrawal"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
