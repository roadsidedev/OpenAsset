'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useWalletClient } from 'wagmi';
import { type Address, formatUnits, parseAbi, parseUnits } from 'viem';
import { toast } from 'sonner';
import { useSession } from '@/context/SessionContext';
import { useLoan } from '@/hooks/useLoans';
import { useMarket } from '@/hooks/useMarkets';
import { useChainOrchestrator } from '@/hooks/useChainOrchestrator';
import { createChainClient, DEFAULT_CHAIN_ID } from '@/lib/chains';
import { getChainLabel } from '@/lib/chainLabels';
import { LENDING_MARKET_ABI, ERC20_APPROVE_ABI, LOAN_STATUS } from '@/lib/contractAbis';
import { decodeContractError } from '@/lib/contractErrors';
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react";

const YEAR_SECONDS = 365n * 24n * 3600n;
const BPS_DENOMINATOR = 10000n;
const LIQUIDATION_PENALTY_BPS = 500n; // 5%

interface LoanDetails {
  collateralAmount: bigint;
  principal: bigint;
  startTime: bigint;
  expiryTime: bigint;
  frozenInterestAt: bigint;
  status: number;
  healthFactor: bigint;
  positionHolder: string;
}

export default function RepayPage() {
  const params = useParams();
  const router = useRouter();
  const loanAddress = (params.loanAddress as string || '').toLowerCase();
  const { address: userAddress, isAuthenticated, ready } = useSession();
  const { data: walletClient } = useWalletClient();

  const { data: indexedLoan, isLoading: loanLoading, error: loanError, refetch: refetchLoan } = useLoan(loanAddress);

  const marketAddress = indexedLoan?.marketAddress;
  const contractLoanId = indexedLoan?.contractLoanId ? BigInt(indexedLoan.contractLoanId) : null;

  // Resolve which chain the loan's market lives on (probes all supported
  // chains), then read/write against THAT chain — never the wallet's
  // arbitrary current network.
  const { data: market } = useMarket(marketAddress || '');
  const marketChainId = market?.chainId;
  const { ensureChain, nudgeChain } = useChainOrchestrator();

  // Standalone read client scoped to the market's chain: works regardless of
  // which network the wallet happens to be on.
  const chainClient = useMemo(
    () => createChainClient(marketChainId ?? DEFAULT_CHAIN_ID),
    [marketChainId],
  );

  // Auto-align the wallet as soon as the loan's chain is known (silent for
  // embedded wallets, the wallet's own switch popup for external ones).
  useEffect(() => {
    if (marketChainId) {
      nudgeChain(marketChainId, `This loan lives on ${getChainLabel(marketChainId)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketChainId]);

  const [loan, setLoan] = useState<LoanDetails | null>(null);
  const [aprBps, setAprBps] = useState<bigint>(0n);
  const [lendingAsset, setLendingAsset] = useState<string>('');
  const [lendingDecimals, setLendingDecimals] = useState<number>(18);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [partialAmount, setPartialAmount] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Live loan state + market config from the chain
  useEffect(() => {
    let cancelled = false;
    if (!marketAddress || contractLoanId === null) return;
    (async () => {
      try {
        const marketAddr = marketAddress as Address;
        const [details, apr, lending, decimals] = await Promise.all([
          chainClient.readContract({
            address: marketAddr,
            abi: parseAbi(LENDING_MARKET_ABI),
            functionName: 'getLoanDetails',
            args: [contractLoanId],
          }) as Promise<[bigint, bigint, bigint, bigint, bigint, number, bigint, string]>,
          chainClient.readContract({ address: marketAddr, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'aprBps' }) as Promise<bigint>,
          chainClient.readContract({ address: marketAddr, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'lendingAsset' }) as Promise<string>,
          chainClient.readContract({ address: marketAddr, abi: parseAbi(LENDING_MARKET_ABI), functionName: 'lendingDecimals' }).catch(() => 18n) as Promise<bigint | number>,
        ]);
        if (cancelled) return;
        setLoan({
          collateralAmount: details[0],
          principal: details[1],
          startTime: details[2],
          expiryTime: details[3],
          frozenInterestAt: details[4],
          status: Number(details[5]),
          healthFactor: details[6],
          positionHolder: details[7],
        });
        setAprBps(apr);
        setLendingAsset(lending.toLowerCase());
        setLendingDecimals(typeof decimals === 'bigint' ? Number(decimals) : decimals);
      } catch (err) {
        console.error('Failed to read loan details', err);
      }
    })();
    return () => { cancelled = true; };
  }, [chainClient, marketAddress, contractLoanId, refreshKey]);

  // Allowance of the repayer for the market
  useEffect(() => {
    let cancelled = false;
    if (!lendingAsset || !userAddress || !marketAddress) return;
    (async () => {
      try {
        const a = await chainClient.readContract({
          address: lendingAsset as Address,
          abi: parseAbi(ERC20_APPROVE_ABI),
          functionName: 'allowance',
          args: [userAddress as Address, marketAddress as Address],
        }) as bigint;
        if (!cancelled) setAllowance(a);
      } catch { if (!cancelled) setAllowance(0n); }
    })();
    return () => { cancelled = true; };
  }, [chainClient, lendingAsset, userAddress, marketAddress, refreshKey, isBusy]);

  // Mirror of LendingMarketV2._calculateInterest + CURE penalty
  const { interest, penalty, totalDebt } = useMemo(() => {
    if (!loan || loan.principal === 0n) return { interest: 0n, penalty: 0n, totalDebt: 0n };
    const active = loan.status === 0 || loan.status === 1 || loan.status === 2; // ACTIVE / GRACE / CURE
    if (!active) return { interest: 0n, penalty: 0n, totalDebt: 0n };
    let elapsed: bigint;
    if (loan.status === 2 && loan.frozenInterestAt > 0n) {
      elapsed = loan.frozenInterestAt > loan.startTime ? loan.frozenInterestAt - loan.startTime : 0n;
    } else {
      elapsed = BigInt(Math.floor(Date.now() / 1000)) > loan.startTime
        ? BigInt(Math.floor(Date.now() / 1000)) - loan.startTime
        : 0n;
    }
    const i = (loan.principal * aprBps * elapsed) / (BPS_DENOMINATOR * YEAR_SECONDS);
    const p = loan.status === 2 ? (loan.principal * LIQUIDATION_PENALTY_BPS) / BPS_DENOMINATOR : 0n;
    return { interest: i, penalty: p, totalDebt: loan.principal + i + p };
  }, [loan, aprBps]);

  const repayable = loan !== null && (loan.status === 0 || loan.status === 1 || loan.status === 2);
  const isHolder = loan !== null && userAddress !== undefined && userAddress !== null && loan.positionHolder.toLowerCase() === userAddress.toLowerCase();

  const executeRepay = useCallback(async (amount: bigint | null) => {
    if (!walletClient || !marketAddress || contractLoanId === null || !lendingAsset) return;
    setIsBusy(true);
    const toastId = toast.loading(amount === null ? 'Repaying loan...' : 'Repaying partial amount...');
    try {
      // Auto-align the wallet to the loan's chain first (silent for embedded
      // wallets; the wallet's own switch popup for external ones). No
      // in-app "switch network" button — if the user rejects the popup the
      // orchestrator raises the fallback banner and this throws.
      if (marketChainId) {
        const chainResult = await ensureChain(
          marketChainId,
          `This loan lives on ${getChainLabel(marketChainId)}`,
        );
        if (!chainResult.ok) {
          throw new Error(`Approve the switch to ${getChainLabel(marketChainId)} in your wallet to repay.`);
        }
      }
      const required = amount ?? totalDebt;
      if (required > allowance) {
        toast.loading('Approving stablecoin spend...', { id: toastId });
        const approveHash = await walletClient.writeContract({
          address: lendingAsset as Address,
          abi: parseAbi(ERC20_APPROVE_ABI),
          functionName: 'approve',
          args: [marketAddress as Address, required],
        });
        await chainClient.waitForTransactionReceipt({ hash: approveHash });
        toast.loading('Executing repayment...', { id: toastId });
      }
      const hash = await walletClient.writeContract({
        address: marketAddress as Address,
        abi: parseAbi(LENDING_MARKET_ABI),
        functionName: amount === null ? 'repay' : 'repayPartial',
        args: amount === null ? [contractLoanId] : [contractLoanId, amount],
      });
      const receipt = await chainClient.waitForTransactionReceipt({ hash });
      toast.success('Loan repayment confirmed!', {
        id: toastId,
        description: `Tx: ${receipt.transactionHash.slice(0, 14)}...`,
      });
      setPartialAmount('');
      setRefreshKey((k) => k + 1);
      refetchLoan();
    } catch (err) {
      toast.error(decodeContractError(err) || (err instanceof Error ? err.message : 'Repayment failed.'), { id: toastId });
    } finally {
      setIsBusy(false);
    }
  }, [walletClient, chainClient, marketChainId, ensureChain, marketAddress, contractLoanId, lendingAsset, allowance, totalDebt, refetchLoan]);

  const handlePartial = useCallback(() => {
    if (!partialAmount || !lendingDecimals) return;
    const amount = parseUnits(partialAmount, lendingDecimals);
    if (amount === 0n || amount > totalDebt) return;
    void executeRepay(amount);
  }, [partialAmount, lendingDecimals, totalDebt, executeRepay]);

  const fmt = (v: bigint) => formatUnits(v, lendingDecimals);

  if (loanLoading) {
    return (
      <div className="min-h-dvh bg-background px-4 py-12">
        <div className="mx-auto max-w-lg space-y-6">
          <div className="h-8 w-32 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-3xl bg-muted/50" />
        </div>
      </div>
    );
  }

  if (loanError || !indexedLoan) {
    return (
      <div className="min-h-dvh bg-background px-4 py-12">
        <div className="mx-auto max-w-lg space-y-6">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-premium active-press">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
            <p className="font-medium text-foreground">Loan not found</p>
            <p className="text-sm text-muted-foreground">No indexed loan at this address. Loans are keyed by their loan-contract address.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-premium active-press"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div>
          <h1 className="text-2xl font-bold text-foreground text-balance">Repay Loan</h1>
          <p className="text-sm text-muted-foreground">Repay your loan to reclaim your collateral.</p>
        </div>

        {!loan ? (
          <div className="rounded-3xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Loan #{contractLoanId?.toString()} is indexed but could not be read on-chain. The RPC may be temporarily unavailable, or this market has not finished indexing.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Loan ID</p>
                <p className="font-mono text-foreground">#{contractLoanId?.toString()}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className={loan.status === 0 || loan.status === 1 ? 'text-emerald-500' : loan.status === 2 ? 'text-amber-500' : 'text-foreground'}>
                  {LOAN_STATUS[loan.status] || 'UNKNOWN'}
                </p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Principal</p>
                <p className="text-foreground">{fmt(loan.principal)}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Health Factor</p>
                <p className={loan.healthFactor !== 0n && loan.healthFactor < 12000n ? 'text-destructive' : 'text-emerald-500'}>
                  {loan.healthFactor === 0n ? '—' : (Number(loan.healthFactor) / 10000).toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Accrued Interest</p>
                <p className="text-foreground">{fmt(interest)}</p>
              </div>
              {penalty > 0n && (
                <div className="rounded-2xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Cure Penalty (5%)</p>
                  <p className="text-amber-500">{fmt(penalty)}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-ice-400/30 bg-ice-400/5 p-4">
              <p className="text-xs text-muted-foreground">Total owed (principal + interest{penalty > 0n ? ' + penalty' : ''})</p>
              <p className="text-xl font-bold text-foreground">{repayable ? fmt(totalDebt) : '—'}</p>
            </div>

            {repayable ? (
              <>
                <button
                  onClick={() => executeRepay(null)}
                  disabled={!isAuthenticated || !userAddress || !walletClient || isBusy || totalDebt === 0n}
                  className="w-full rounded-2xl bg-ice-300 dark:bg-ice-400 px-4 py-3 text-sm font-bold text-slate-900 hover:bg-ice-400 dark:hover:bg-ice-300 transition-premium active-press disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBusy ? 'Working...' : ready && !isAuthenticated ? 'Sign in to repay' : !walletClient ? 'Connect wallet to repay' : `Repay Full (${fmt(totalDebt)})`}
                </button>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Partial repayment (optional)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder={`Max ${repayable ? fmt(totalDebt) : '0'}`}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      disabled={isBusy}
                      className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground disabled:opacity-50"
                    />
                    <button
                      onClick={handlePartial}
                      disabled={isBusy || !partialAmount || parseUnits(partialAmount || '0', lendingDecimals) === 0n || parseUnits(partialAmount || '0', lendingDecimals) > totalDebt}
                      className="shrink-0 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Repay Partial
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Interest and penalties are paid first; the remainder reduces principal. Collateral returns only on full repayment.
                  </p>
                </div>

                {!isHolder && loan.positionHolder !== '0x0000000000000000000000000000000000000000' && (
                  <p className="text-xs text-amber-500">
                    You are not the position holder — anyone may repay, but collateral releases to the current position holder.
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
                {loan.status === 4 ? 'This loan is already repaid.' : loan.status === 5 ? 'This loan was liquidated.' : 'This loan is settling asynchronously and cannot be repaid right now.'}
              </div>
            )}
          </div>
        )}

        {marketAddress && (
          <Link
            href={`/markets/${marketAddress}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View market <ArrowSquareOut className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
