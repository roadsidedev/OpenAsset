'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { LOAN_STATUS } from '@/lib/contractAbis';

export default function RepayPage() {
  const params = useParams();
  const router = useRouter();
  const loanId = params.loanId as string;
  const { address: userAddress } = useAccount();
  const [isRepaying, setIsRepaying] = useState(false);

  // Mock loan data — in production, fetch from API
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
    // In production: call repay(loanId) on LendingMarketV2
    setTimeout(() => {
      setIsRepaying(false);
      alert('Repay simulated — connect to a testnet to execute');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="mx-auto max-w-lg">
        <button onClick={() => router.back()} className="mb-6 text-sm text-zinc-400 hover:text-white">&larr; Back</button>
        <h1 className="mb-2 text-2xl font-bold text-white">Repay Loan</h1>
        <p className="mb-6 text-sm text-zinc-400">Repay your loan to reclaim your collateral.</p>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-zinc-800/50 p-3">
              <p className="text-xs text-zinc-500">Loan ID</p>
              <p className="font-mono text-white">#{loanId}</p>
            </div>
            <div className="rounded-lg bg-zinc-800/50 p-3">
              <p className="text-xs text-zinc-500">Status</p>
              <p className="text-white">{LOAN_STATUS[loan.status] || 'UNKNOWN'}</p>
            </div>
            <div className="rounded-lg bg-zinc-800/50 p-3">
              <p className="text-xs text-zinc-500">Principal</p>
              <p className="text-white">{Number(loan.principal) / 1e18} tokens</p>
            </div>
            <div className="rounded-lg bg-zinc-800/50 p-3">
              <p className="text-xs text-zinc-500">Health Factor</p>
              <p className={`${loan.healthFactor < 12000 ? 'text-red-400' : 'text-emerald-400'}`}>
                {(loan.healthFactor / 10000).toFixed(2)}
              </p>
            </div>
          </div>

          <button
            onClick={handleRepay}
            disabled={!userAddress || isRepaying}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isRepaying ? 'Repaying...' : userAddress ? 'Repay Loan' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}
