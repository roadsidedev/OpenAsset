"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { parseUnits } from "viem";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { useMarket } from "@/hooks/useMarkets";
import { Warning } from "@phosphor-icons/react";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DepositModal({ open, onOpenChange }: DepositModalProps) {
  const params = useParams();
  const marketId = params.marketId as string;
  const { data: market } = useMarket(marketId);
  const { depositLiquidity, isLoading, error } = useContractInteraction();
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (!amount || !market) return;
    try {
      const parsed = parseUnits(amount, 6);
      const result = await depositLiquidity(market.marketAddress, market.loanAsset, parsed);
      setTxHash(result.txHash);
      setTimeout(() => {
        setAmount("");
        setTxHash(null);
        onOpenChange(false);
      }, 3000);
    } catch (err) {
      console.error("Deposit failed:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Deposit Assets</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Deposit stablecoins to earn yield from borrower interest.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Amount (USDC)</label>
            <input
              type="number"
              placeholder="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <Warning className="h-4 w-4 mt-0.5 shrink-0" />
              {error.message}
            </div>
          )}

          {txHash && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              Deposited! Tx: {txHash.slice(0, 10)}...
            </div>
          )}

          <button
            onClick={handleDeposit}
            disabled={!amount || isLoading}
            className="w-full rounded-2xl bg-ice-300 dark:bg-ice-400 text-slate-900 font-bold text-sm py-3 hover:bg-ice-400 dark:hover:bg-ice-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Approving & Depositing..." : "Confirm Deposit"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
