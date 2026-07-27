'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { LOAN_STATUS } from '@/lib/contractAbis';
import { ArrowLeft } from "@phosphor-icons/react";

export default function RepayPage() {
  const params = useParams();
  const router = useRouter();
  const loanId = params.loanId as string;
  const { address: userAddress } = useAccount();
  const [isRepaying, setIsRepaying] = useState(false);

  const loan = {
    contractLoanId: loanId,
    principal: '5000000000000000000',
    collateralAmount: '10000000000000000000',
    status: 0,
    healthFactor: 15000,
  };

  const handleRepay = async () => {
    if (!userAddress) return;
    setIsRepaying(true);
    setTimeout(() => {
      setIsRepaying(false);
      alert('Repay simulated — connect to a testnet to execute');
    }, 2000);
  };

  return (
    <div className="min-h-dvh bg-background px-4 py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-premium active-press"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div>
          <h1 className="text-2xl font-bold text-foreground text-balance">Repay Loan</h1>
          <p className="text-sm text-muted-foreground">Repay your loan to reclaim your collateral.</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Loan ID</p>
              <p className="font-mono text-foreground">#{loanId}</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-foreground">{LOAN_STATUS[loan.status] || 'UNKNOWN'}</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Principal</p>
              <p className="text-foreground">{Number(loan.principal) / 1e18} tokens</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Health Factor</p>
              <p className={loan.healthFactor < 12000 ? 'text-destructive' : 'text-emerald-500'}>
                {(loan.healthFactor / 10000).toFixed(2)}
              </p>
            </div>
          </div>

          <button
            onClick={handleRepay}
            disabled={!userAddress || isRepaying}
            className="w-full rounded-2xl bg-ice-300 dark:bg-ice-400 px-4 py-3 text-sm font-bold text-slate-900 hover:bg-ice-400 dark:hover:bg-ice-300 transition-premium active-press disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRepaying ? 'Repaying...' : userAddress ? 'Repay Loan' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}
