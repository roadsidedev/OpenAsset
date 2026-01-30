/**
 * @file useContractInteraction.ts
 * @description Production-grade Web3 interaction hook
 */

import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { parseAbi, Address } from 'viem';
import { MARKET_FACTORY_ABI, LENDING_MARKET_ABI, LOAN_CONTRACT_ABI } from '@/lib/contractAbis';

export interface CreateMarketParams {
  collateralAsset: string;
  loanAsset: string;
  assetType: number;
  oracleType: number;
  primaryOracle: string;
  nftOracle: string;
  ltvBps: number;
  aprBps: number;
  durationSeconds: number;
  initialLiquidity: string;
}

export interface RequestLoanParams {
  collateralAmount: string;
  tokenId: number;
  erc1155Amount: string;
  desiredPrincipal: string;
}

export const useContractInteraction = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const clearError = useCallback(() => setError(null), []);

  const createMarket = useCallback(
    async (params: CreateMarketParams, factoryAddress: string) => {
      setIsLoading(true);
      clearError();

      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: factoryAddress as Address,
          abi: parseAbi(MARKET_FACTORY_ABI),
          functionName: 'createMarket',
          args: [
            params.collateralAsset as Address,
            params.loanAsset as Address,
            params.assetType,
            params.oracleType,
            params.primaryOracle as Address,
            params.nftOracle as Address,
            BigInt(params.ltvBps),
            BigInt(params.aprBps),
            BigInt(params.durationSeconds),
            BigInt(params.initialLiquidity),
          ],
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
    async (marketAddress: string, params: RequestLoanParams) => {
      setIsLoading(true);
      clearError();

      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'requestLoan',
          args: [
            BigInt(params.collateralAmount),
            BigInt(params.tokenId),
            BigInt(params.erc1155Amount),
            BigInt(params.desiredPrincipal),
          ],
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

  const repayLoan = useCallback(
    async (loanAddress: string, repaymentAmount: string) => {
      setIsLoading(true);
      clearError();

      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: loanAddress as Address,
          abi: parseAbi(LOAN_CONTRACT_ABI),
          functionName: 'repayLoan',
          args: [BigInt(repaymentAmount)],
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
    repayLoan,
    isLoading,
    error,
    clearError,
  };
};
