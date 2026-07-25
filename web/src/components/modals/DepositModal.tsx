"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DepositModal({ open, onOpenChange }: DepositModalProps) {
  const [amount, setAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);

  const handleDeposit = async () => {
    if (!amount) return;
    setIsDepositing(true);
    setTimeout(() => {
      setIsDepositing(false);
      setAmount("");
      onOpenChange(false);
    }, 2000);
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
          <button
            onClick={handleDeposit}
            disabled={!amount || isDepositing}
            className="w-full rounded-2xl bg-ice-300 dark:bg-ice-400 text-slate-900 font-bold text-sm py-3 hover:bg-ice-400 dark:hover:bg-ice-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDepositing ? "Depositing..." : "Confirm Deposit"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
