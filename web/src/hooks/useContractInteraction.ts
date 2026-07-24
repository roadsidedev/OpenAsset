'use client';

import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { parseAbi, Address } from 'viem';
import { MARKET_FACTORY_ABI, LENDING_MARKET_ABI } from '@/lib/contractAbis';

export const useContractInteraction = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const clearError = useCallback(() => setError(null), []);

  const createMarket = useCallback(
    async (marketConfig: any, factoryAddress: string, initialLiquidity: bigint) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: factoryAddress as Address,
          abi: parseAbi(MARKET_FACTORY_ABI),
          functionName: 'createMarket',
          args: [marketConfig, initialLiquidity],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, publicClient, clearError]
  );

  const depositLiquidity = useCallback(
    async (marketAddress: string, amount: string) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'depositLiquidity',
          args: [BigInt(amount)],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, publicClient, clearError]
  );

  const requestLoan = useCallback(
    async (marketAddress: string, collateralAmount: string) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'requestLoan',
          args: [BigInt(collateralAmount)],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, publicClient, clearError]
  );

  const repay = useCallback(
    async (marketAddress: string, loanId: string) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'repay',
          args: [BigInt(loanId)],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, publicClient, clearError]
  );

  const liquidate = useCallback(
    async (marketAddress: string, loanId: string) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'liquidate',
          args: [BigInt(loanId)],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, publicClient, clearError]
  );

  return {
    createMarket,
    depositLiquidity,
    requestLoan,
    repay,
    liquidate,
    isLoading,
    error,
    clearError,
  };
};
