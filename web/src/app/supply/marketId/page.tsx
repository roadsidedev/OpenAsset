'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

export default function SupplyPage() {
  const params = useParams();
  const router = useRouter();
  const marketAddress = params.marketId as string;
  const { address: userAddress } = useAccount();
  const [amount, setAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);

  const handleDeposit = async () => {
    if (!userAddress || !amount) return;
    setIsDepositing(true);
    // In production: approve ERC20, then call depositLiquidity
    setTimeout(() => {
      setIsDepositing(false);
      alert('Deposit simulated — connect to a testnet to execute');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="mx-auto max-w-lg">
        <button onClick={() => router.back()} className="mb-6 text-sm text-zinc-400 hover:text-white">&larr; Back</button>
        <h1 className="mb-2 text-2xl font-bold text-white">Supply Liquidity</h1>
        <p className="mb-6 text-sm text-zinc-400">Deposit stablecoins to earn yield from borrower interest.</p>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
          <div className="rounded-lg bg-zinc-800/50 p-3 text-xs text-zinc-500 font-mono break-all">
            Market: {marketAddress}
          </div>
          <div>
            <label className="block text-sm text-zinc-200">Deposit Amount (stablecoins)</label>
            <input
              type="number"
              placeholder="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleDeposit}
            disabled={!userAddress || !amount || isDepositing}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isDepositing ? 'Depositing...' : userAddress ? 'Deposit' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}
