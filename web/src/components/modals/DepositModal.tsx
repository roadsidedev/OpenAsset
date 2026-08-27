"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { useWalletSession } from "@/hooks/useWalletSession";
import type { Market } from "@/hooks/useMarkets";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markets: Market[];
}

export function DepositModal({ open, onOpenChange, markets }: DepositModalProps) {
  const queryClient = useQueryClient();
  const { address, ensureWallet } = useWalletSession();
  const { depositLiquidity, isLoading } = useContractInteraction();
  const [amount, setAmount] = useState("");
  const [marketAddress, setMarketAddress] = useState("");

  const selectable = useMemo(
    () => markets.filter((m) => m.marketAddress && m.loanAsset),
    [markets],
  );
  const selected = selectable.find((m) => m.marketAddress.toLowerCase() === marketAddress.toLowerCase());

  useEffect(() => {
    if (!open) return;
    if (!marketAddress && selectable[0]) setMarketAddress(selectable[0].marketAddress);
  }, [open, selectable, marketAddress]);

  const handleDeposit = async () => {
    if (!amount || Number(amount) <= 0) return;
    if (!address) {
      await ensureWallet();
      return;
    }
    if (!selected) {
      toast.error("Select a market to deposit into.");
      return;
    }
    const toastId = toast.loading("Approving and depositing liquidity...");
    try {
      const parsed = parseUnits(amount, 6);
      const result = await depositLiquidity(
        selected.marketAddress,
        selected.loanAsset,
        parsed,
        selected.chainId,
      );
      toast.success("Deposit confirmed", {
        id: toastId,
        description: `Tx: ${result.txHash.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      setAmount("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deposit failed. Please try again.", { id: toastId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Deposit liquidity</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Deposit USDC into a market to earn borrower interest. This sends an on-chain transaction.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Market</label>
            <select
              value={marketAddress}
              onChange={(e) => setMarketAddress(e.target.value)}
              className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
            >
              {selectable.length === 0 && <option value="">No markets available</option>}
              {selectable.map((market) => (
                <option key={market.marketAddress} value={market.marketAddress}>
                  {market.marketAddress.slice(0, 8)}…{market.marketAddress.slice(-4)} · {formatUnits(BigInt(market.liquidity?.available || "0"), 6)} USDC available
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Amount (USDC)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={handleDeposit}
            disabled={!amount || Number(amount) <= 0 || isLoading || selectable.length === 0}
            className="w-full rounded-2xl bg-ice-300 dark:bg-ice-400 text-slate-900 font-bold text-sm py-3 hover:bg-ice-400 dark:hover:bg-ice-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!address ? "Connect wallet" : isLoading ? "Confirm in wallet..." : "Confirm deposit"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
