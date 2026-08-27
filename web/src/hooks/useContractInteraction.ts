'use client';

import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient, useSwitchChain } from 'wagmi';
import { parseAbi, type Address, type Hex } from 'viem';
import { MARKET_FACTORY_ABI, MARKET_FACTORY_ABI_TYPED, MARKET_FACTORY_B20_ABI, MARKET_FACTORY_PROVIDER_ABI, LENDING_MARKET_ABI, ADAPTER_REGISTRY_ABI_TYPED, ERC20_APPROVE_ABI, LP_TOKEN_ABI } from '@/lib/contractAbis';
import { decodeContractError } from '@/lib/contractErrors';
import { createChainClient } from '@/lib/chains';

export const useContractInteraction = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();

  const clearError = useCallback(() => setError(null), []);

  const readerFor = useCallback((chainId?: number) => {
    if (chainId) return createChainClient(chainId) || publicClient;
    return publicClient;
  }, [publicClient]);

  const ensureChain = useCallback(async (chainId?: number) => {
    if (!chainId || !walletClient) return;
    const current = await walletClient.getChainId().catch(() => undefined);
    if (current && current !== chainId && typeof switchChainAsync === 'function') {
      await switchChainAsync({ chainId });
    }
  }, [walletClient, switchChainAsync]);

  const approveToken = useCallback(
    async (tokenAddress: string, spenderAddress: string, amount: bigint) => {
      if (!walletClient) throw new Error('Wallet not connected');
      if (!publicClient) throw new Error('Public client not available');

      const hash = await walletClient.writeContract({
        address: tokenAddress as Address,
        abi: parseAbi(ERC20_APPROVE_ABI),
        functionName: 'approve',
        args: [spenderAddress as Address, amount],
      });
      return publicClient.waitForTransactionReceipt({ hash });
    },
    [walletClient, publicClient]
  );

  const createMarket = useCallback(
    async (
      marketConfig: any,
      factoryAddress: string,
      initialLiquidity: bigint,
      b20Config?: { feed: string; maxStaleness: bigint; l2Sequencer: string },
      providerConfig?: { providerId: Hex; providerData: Hex },
    ) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        // If there's initial liquidity, approve the factory to spend it first
        if (initialLiquidity > BigInt(0) && marketConfig.lendingAsset) {
          const allowance = await publicClient.readContract({
            address: marketConfig.lendingAsset as Address,
            abi: parseAbi(ERC20_APPROVE_ABI),
            functionName: 'allowance',
            args: [walletClient.account.address, factoryAddress as Address],
          }) as bigint;

          if (allowance < initialLiquidity) {
            const approveHash = await walletClient.writeContract({
              address: marketConfig.lendingAsset as Address,
              abi: parseAbi(ERC20_APPROVE_ABI),
              functionName: 'approve',
              args: [factoryAddress as Address, initialLiquidity],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }
        }

        const hash = await walletClient.writeContract({
          address: factoryAddress as Address,
          abi: providerConfig
            ? MARKET_FACTORY_PROVIDER_ABI
            : b20Config
              ? MARKET_FACTORY_B20_ABI
              : MARKET_FACTORY_ABI_TYPED,
          functionName: providerConfig
            ? 'createProviderMarket'
            : b20Config
              ? 'createB20Market'
              : 'createMarket',
          args: providerConfig
            ? [marketConfig, initialLiquidity, providerConfig]
            : b20Config
              ? [marketConfig, initialLiquidity, b20Config]
              : [marketConfig, initialLiquidity],
        } as any);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, publicClient, clearError]
  );

  const depositLiquidity = useCallback(
    async (marketAddress: string, lendingAsset: string, amount: bigint, chainId?: number) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(chainId);
        const reader = readerFor(chainId);
        if (!reader) throw new Error('Public client not available');

        const allowance = await reader.readContract({
          address: lendingAsset as Address,
          abi: parseAbi(ERC20_APPROVE_ABI),
          functionName: 'allowance',
          args: [walletClient.account.address, marketAddress as Address],
        }) as bigint;

        if (allowance < amount) {
          const approveHash = await walletClient.writeContract({
            address: lendingAsset as Address,
            abi: parseAbi(ERC20_APPROVE_ABI),
            functionName: 'approve',
            args: [marketAddress as Address, amount],
          });
          await reader.waitForTransactionReceipt({ hash: approveHash });
        }

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'depositLiquidity',
          args: [amount],
        });

        const receipt = await reader.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, readerFor, ensureChain, clearError]
  );

  const withdrawLiquidity = useCallback(
    async (marketAddress: string, amount: bigint, chainId?: number) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(chainId);
        const reader = readerFor(chainId);
        if (!reader) throw new Error('Public client not available');

        const account = walletClient.account.address as Address;
        const [lpToken, totalLiq, availLiq] = await Promise.all([
          reader.readContract({
            address: marketAddress as Address,
            abi: parseAbi(LENDING_MARKET_ABI),
            functionName: 'lpToken',
          }) as Promise<Address>,
          reader.readContract({
            address: marketAddress as Address,
            abi: parseAbi(LENDING_MARKET_ABI),
            functionName: 'totalLiquidity',
          }) as Promise<bigint>,
          reader.readContract({
            address: marketAddress as Address,
            abi: parseAbi(LENDING_MARKET_ABI),
            functionName: 'availableLiquidity',
          }) as Promise<bigint>,
        ]);

        const [lpBalance, lpSupply] = await Promise.all([
          reader.readContract({
            address: lpToken,
            abi: parseAbi(LP_TOKEN_ABI),
            functionName: 'balanceOf',
            args: [account],
          }) as Promise<bigint>,
          reader.readContract({
            address: lpToken,
            abi: parseAbi(LP_TOKEN_ABI),
            functionName: 'totalSupply',
          }) as Promise<bigint>,
        ]);

        if (lpSupply === 0n || lpBalance === 0n) throw new Error('No LP shares to withdraw');
        if (amount > availLiq) throw new Error('Insufficient available liquidity in this market');

        const userValue = (lpBalance * totalLiq) / lpSupply;
        let shares = amount >= userValue ? lpBalance : (amount * lpSupply) / totalLiq;
        if (shares > lpBalance) shares = lpBalance;
        if (shares === 0n) throw new Error('Amount too small to withdraw');

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'withdrawLiquidity',
          args: [shares],
        });

        const receipt = await reader.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, readerFor, ensureChain, clearError]
  );

  const requestLoan = useCallback(
    async (
      marketAddress: string,
      collateralAddress: string,
      collateralAmount: string,
      assetAdapter: string,
      requestedPrincipal?: bigint,
    ) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        const amount = BigInt(collateralAmount);

        // Approve the asset adapter to escrow collateral
        if (assetAdapter) {
          const allowance = await publicClient.readContract({
            address: collateralAddress as Address,
            abi: parseAbi(ERC20_APPROVE_ABI),
            functionName: 'allowance',
            args: [walletClient.account.address, assetAdapter as Address],
          }) as bigint;

          if (allowance < amount) {
            const approveHash = await walletClient.writeContract({
              address: collateralAddress as Address,
              abi: parseAbi(ERC20_APPROVE_ABI),
              functionName: 'approve',
              args: [assetAdapter as Address, amount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }
        }

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: requestedPrincipal === undefined
            ? 'requestLoan(uint256)'
            : 'requestLoan(uint256,uint256)',
          args: requestedPrincipal === undefined ? [amount] : [amount, requestedPrincipal],
        } as any);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, publicClient, clearError]
  );

  const repay = useCallback(
    async (marketAddress: string, lendingAsset: string, loanId: string, totalRepayment: bigint) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Public client not available');

        if (totalRepayment > BigInt(0)) {
          const allowance = await publicClient.readContract({
            address: lendingAsset as Address,
            abi: parseAbi(ERC20_APPROVE_ABI),
            functionName: 'allowance',
            args: [walletClient.account.address, marketAddress as Address],
          }) as bigint;

          if (allowance < totalRepayment) {
            const approveHash = await walletClient.writeContract({
              address: lendingAsset as Address,
              abi: parseAbi(ERC20_APPROVE_ABI),
              functionName: 'approve',
              args: [marketAddress as Address, totalRepayment],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }
        }

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'repay',
          args: [BigInt(loanId)],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
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
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, publicClient, clearError]
  );

  // Adapter Registry read functions
  const getAdapterRegistryInfo = useCallback(
    async (registryAddress: string, adapterAddress: string) => {
      if (!publicClient) throw new Error('Public client not available');
      return publicClient.readContract({
        address: registryAddress as Address,
        abi: ADAPTER_REGISTRY_ABI_TYPED,
        functionName: 'getAdapterInfo',
        args: [adapterAddress as Address],
      });
    },
    [publicClient]
  );

  const getAdaptersByType = useCallback(
    async (registryAddress: string, adapterType: number) => {
      if (!publicClient) throw new Error('Public client not available');
      return publicClient.readContract({
        address: registryAddress as Address,
        abi: ADAPTER_REGISTRY_ABI_TYPED,
        functionName: 'getAdaptersByType',
        args: [adapterType],
      });
    },
    [publicClient]
  );

  const getAllAdapters = useCallback(
    async (registryAddress: string) => {
      if (!publicClient) throw new Error('Public client not available');
      return publicClient.readContract({
        address: registryAddress as Address,
        abi: ADAPTER_REGISTRY_ABI_TYPED,
        functionName: 'getAllAdapters',
      });
    },
    [publicClient]
  );

  const isSelectable = useCallback(
    async (registryAddress: string, adapterAddress: string) => {
      if (!publicClient) throw new Error('Public client not available');
      return publicClient.readContract({
        address: registryAddress as Address,
        abi: ADAPTER_REGISTRY_ABI_TYPED,
        functionName: 'isSelectable',
        args: [adapterAddress as Address],
      });
    },
    [publicClient]
  );

  return {
    approveToken,
    createMarket,
    depositLiquidity,
    withdrawLiquidity,
    requestLoan,
    repay,
    liquidate,
    getAdapterRegistryInfo,
    getAdaptersByType,
    getAllAdapters,
    isSelectable,
    isLoading,
    error,
    clearError,
  };
};
