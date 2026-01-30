/**
 * @file useContractInteraction.ts
 * @description Production-grade Web3 interaction hook
 */

import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { Contract, BrowserProvider, toBeHex } from 'ethers';
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

  const clearError = useCallback(() => setError(null), []);

  const createMarket = useCallback(
    async (params: CreateMarketParams, factoryAddress: string) => {
      setIsLoading(true);
      clearError();

      try {
        if (!walletClient) throw new Error('Wallet not connected');

        const provider = new BrowserProvider(walletClient.transport);
        const signer = await provider.getSigner();
        const contract = new Contract(factoryAddress, MARKET_FACTORY_ABI, signer);

        const tx = await contract.createMarket(
          params.collateralAsset,
          params.loanAsset,
          params.assetType,
          params.oracleType,
          params.primaryOracle,
          params.nftOracle,
          params.ltvBps,
          params.aprBps,
          params.durationSeconds,
          toBeHex(params.initialLiquidity)
        );

        const receipt = await tx.wait();
        return { txHash: tx.hash, receipt };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clearError]
  );

  const depositLiquidity = useCallback(
    async (marketAddress: string, amount: string) => {
      setIsLoading(true);
      clearError();

      try {
        if (!walletClient) throw new Error('Wallet not connected');

        const provider = new BrowserProvider(walletClient.transport);
        const signer = await provider.getSigner();
        const contract = new Contract(marketAddress, LENDING_MARKET_ABI, signer);

        const tx = await contract.depositLiquidity(toBeHex(amount));
        const receipt = await tx.wait();
        return { txHash: tx.hash, receipt };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clearError]
  );

  const requestLoan = useCallback(
    async (marketAddress: string, params: RequestLoanParams) => {
      setIsLoading(true);
      clearError();

      try {
        if (!walletClient) throw new Error('Wallet not connected');

        const provider = new BrowserProvider(walletClient.transport);
        const signer = await provider.getSigner();
        const contract = new Contract(marketAddress, LENDING_MARKET_ABI, signer);

        const tx = await contract.requestLoan(
          toBeHex(params.collateralAmount),
          params.tokenId,
          toBeHex(params.erc1155Amount),
          toBeHex(params.desiredPrincipal)
        );

        const receipt = await tx.wait();
        return { txHash: tx.hash, receipt };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clearError]
  );

  const repayLoan = useCallback(
    async (loanAddress: string, repaymentAmount: string) => {
      setIsLoading(true);
      clearError();

      try {
        if (!walletClient) throw new Error('Wallet not connected');

        const provider = new BrowserProvider(walletClient.transport);
        const signer = await provider.getSigner();
        const contract = new Contract(loanAddress, LOAN_CONTRACT_ABI, signer);

        const tx = await contract.repayLoan(toBeHex(repaymentAmount));
        const receipt = await tx.wait();
        return { txHash: tx.hash, receipt };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clearError]
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
