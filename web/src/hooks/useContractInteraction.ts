'use client';

import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient, useChainId, useConfig } from 'wagmi';
import { getPublicClient, getAccount } from '@wagmi/core';
import { parseAbi, type Address, type Hex } from 'viem';
import { MARKET_FACTORY_ABI_TYPED, MARKET_FACTORY_B20_ABI, MARKET_FACTORY_PROVIDER_ABI, LENDING_MARKET_ABI, ADAPTER_REGISTRY_ABI_TYPED, ERC20_APPROVE_ABI } from '@/lib/contractAbis';
import { decodeContractError } from '@/lib/contractErrors';
import { useChainOrchestrator } from '@/hooks/useChainOrchestrator';
import { getChainLabel } from '@/lib/chainLabels';

/**
 * Chain guard: before every write, resolve the wallet onto `targetChainId`
 * (market.chainId or the chain whose factory hosts the config) via the
 * shared orchestrator — embedded (Privy) wallets switch silently, external
 * wallets get the wallet's own switch popup automatically. If that fails
 * (user rejected), the orchestrator raises the one-click banner and this
 * guard throws a typed error the UI can surface.
 */
class ChainGuardError extends Error {
  readonly targetChainId: number;
  readonly currentChainId: number | null;
  constructor(targetChainId: number, currentChainId: number | null) {
    super(`This action runs on ${getChainLabel(targetChainId)}. Approve the network switch in your wallet to continue.`);
    this.name = 'ChainGuardError';
    this.targetChainId = targetChainId;
    this.currentChainId = currentChainId;
  }
}

export const useContractInteraction = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { data: walletClient } = useWalletClient();
  const fallbackClient = usePublicClient();
  const currentChainId = useChainId();
  const config = useConfig();
  const { ensureChain: ensureWalletChain } = useChainOrchestrator();

  const clientForChain = useCallback(
    (targetChainId: number | undefined | null) => {
      if (!targetChainId) return fallbackClient;
      try {
        return (getPublicClient(config, { chainId: targetChainId }) as typeof fallbackClient) ?? fallbackClient;
      } catch {
        return fallbackClient;
      }
    },
    [config, fallbackClient],
  );

  const ensureChain = useCallback(
    async (targetChainId: number | undefined | null) => {
      if (!targetChainId || !walletClient) return;
      // Store-fresh chain id: catches a switch that resolved moments ago.
      const current = getAccount(config).chainId ?? currentChainId ?? walletClient.chain?.id ?? null;
      if (current === targetChainId) return;
      const result = await ensureWalletChain(
        targetChainId,
        `This action runs on ${getChainLabel(targetChainId)}`,
      );
      if (!result.ok) throw new ChainGuardError(targetChainId, current);
    },
    [walletClient, config, currentChainId, ensureWalletChain],
  );

  const clearError = useCallback(() => setError(null), []);

  const approveToken = useCallback(
    async (tokenAddress: string, spenderAddress: string, amount: bigint) => {
      if (!walletClient) throw new Error('Wallet not connected');
      if (!fallbackClient) throw new Error('Public client not available');

      const hash = await walletClient.writeContract({
        address: tokenAddress as Address,
        abi: parseAbi(ERC20_APPROVE_ABI),
        functionName: 'approve',
        args: [spenderAddress as Address, amount],
      });
      return fallbackClient.waitForTransactionReceipt({ hash });
    },
    [walletClient, fallbackClient]
  );

  const createMarket = useCallback(
    async (
      // MarketConfig struct — layout mirrors MarketFactoryV2.MarketConfig
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      marketConfig: any,
      factoryAddress: string,
      initialLiquidity: bigint,
      b20Config?: { feed: string; maxStaleness: bigint; l2Sequencer: string },
      providerConfig?: { providerId: Hex; providerData: Hex },
      targetChainId?: number,
    ) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(targetChainId);
        const activeClient = clientForChain(targetChainId);
        if (!activeClient) throw new Error('Public client not available');

        // If there's initial liquidity, approve the factory to spend it first
        if (initialLiquidity > BigInt(0) && marketConfig.lendingAsset) {
          const allowance = await activeClient.readContract({
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
            await activeClient.waitForTransactionReceipt({ hash: approveHash });
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        const receipt = await activeClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clientForChain, clearError, ensureChain]
  );

  const depositLiquidity = useCallback(
    async (marketAddress: string, lendingAsset: string, amount: bigint, targetChainId?: number) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(targetChainId);
        const activeClient = clientForChain(targetChainId);
        if (!activeClient) throw new Error('Public client not available');

        // Approve the market to spend lendingAsset
        const allowance = await activeClient.readContract({
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
          await activeClient.waitForTransactionReceipt({ hash: approveHash });
        }

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'depositLiquidity',
          args: [amount],
        });

        const receipt = await activeClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clientForChain, clearError, ensureChain]
  );


  const withdrawLiquidity = useCallback(
    async (marketAddress: string, shares: bigint, targetChainId?: number) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(targetChainId);
        const activeClient = clientForChain(targetChainId);
        if (!activeClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'withdrawLiquidity',
          args: [shares],
        });

        const receipt = await activeClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clientForChain, clearError, ensureChain]
  );

  const requestLoan = useCallback(
    async (
      marketAddress: string,
      collateralAddress: string,
      collateralAmount: string,
      assetAdapter: string,
      requestedPrincipal?: bigint,
      targetChainId?: number,
    ) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(targetChainId);
        const activeClient = clientForChain(targetChainId);
        if (!activeClient) throw new Error('Public client not available');

        const amount = BigInt(collateralAmount);

        // Approve the asset adapter to escrow collateral
        if (assetAdapter) {
          const allowance = await activeClient.readContract({
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
            await activeClient.waitForTransactionReceipt({ hash: approveHash });
          }
        }

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: requestedPrincipal === undefined
            ? 'requestLoan(uint256)'
            : 'requestLoan(uint256,uint256)',
          args: requestedPrincipal === undefined ? [amount] : [amount, requestedPrincipal],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        const receipt = await activeClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clientForChain, clearError, ensureChain]
  );

  const repay = useCallback(
    async (marketAddress: string, lendingAsset: string, loanId: string, totalRepayment: bigint, targetChainId?: number) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(targetChainId);
        const activeClient = clientForChain(targetChainId);
        if (!activeClient) throw new Error('Public client not available');

        if (totalRepayment > BigInt(0)) {
          const allowance = await activeClient.readContract({
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
            await activeClient.waitForTransactionReceipt({ hash: approveHash });
          }
        }

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'repay',
          args: [BigInt(loanId)],
        });

        const receipt = await activeClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clientForChain, clearError, ensureChain]
  );

  const liquidate = useCallback(
    async (marketAddress: string, loanId: string, targetChainId?: number) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(targetChainId);
        const activeClient = clientForChain(targetChainId);
        if (!activeClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'liquidate',
          args: [BigInt(loanId)],
        });

        const receipt = await activeClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clientForChain, clearError, ensureChain]
  );

  /**
   * Register an adapter permissionlessly (AdapterRegistry.registerAdapter).
   * Anyone can call it; the entry starts unverified (verified=false) until
   * audit governance reviews it. Mirrors the createMarket write pattern:
   * chain-guarded, wallet-signed, receipt-awaited, errors decoded.
   */
  const registerAdapter = useCallback(
    async (registryAddress: string, adapterAddress: string, adapterType: number, targetChainId?: number) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(targetChainId);
        const activeClient = clientForChain(targetChainId);
        if (!activeClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: registryAddress as Address,
          abi: ADAPTER_REGISTRY_ABI_TYPED,
          functionName: 'registerAdapter',
          args: [adapterAddress as Address, adapterType],
        });

        const receipt = await activeClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clientForChain, clearError, ensureChain]
  );

  /**
   * Register with the developer catalog record shown to market creators
   * (AdapterRegistry.registerAdapterWithMetadata). Same write pattern;
   * metadata starts UNREVIEWED on-chain.
   */
  const registerAdapterWithMetadata = useCallback(
    async (
      registryAddress: string,
      input: {
        adapterAddress: string;
        adapterType: number;
        name: string;
        version: string;
        category: string;
        supportedAssets: string;
        documentationURI: string;
        repositoryURI: string;
      },
      targetChainId?: number,
    ) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(targetChainId);
        const activeClient = clientForChain(targetChainId);
        if (!activeClient) throw new Error('Public client not available');

        const hash = await walletClient.writeContract({
          address: registryAddress as Address,
          abi: ADAPTER_REGISTRY_ABI_TYPED,
          functionName: 'registerAdapterWithMetadata',
          args: [
            input.adapterAddress as Address,
            input.adapterType,
            input.name,
            input.version,
            input.category,
            input.supportedAssets,
            input.documentationURI,
            input.repositoryURI,
          ],
        });

        const receipt = await activeClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clientForChain, clearError, ensureChain]
  );

  /**
   * Market-owner circuit-breaker control: pause/unpause a live market
   * (on-chain onlyMarketOwner; surfaced in the owner Risk Controls panel).
   */
  const pauseMarket = useCallback(
    async (marketAddress: string, targetChainId?: number) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(targetChainId);
        const activeClient = clientForChain(targetChainId);
        if (!activeClient) throw new Error('Public client not available');
        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'pause',
        });
        const receipt = await activeClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clientForChain, clearError, ensureChain]
  );

  const unpauseMarket = useCallback(
    async (marketAddress: string, targetChainId?: number) => {
      setIsLoading(true);
      clearError();
      try {
        if (!walletClient) throw new Error('Wallet not connected');
        await ensureChain(targetChainId);
        const activeClient = clientForChain(targetChainId);
        if (!activeClient) throw new Error('Public client not available');
        const hash = await walletClient.writeContract({
          address: marketAddress as Address,
          abi: parseAbi(LENDING_MARKET_ABI),
          functionName: 'unpause',
        });
        const receipt = await activeClient.waitForTransactionReceipt({ hash });
        return { txHash: hash, receipt };
      } catch (err) {
        const error = new Error(decodeContractError(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, clientForChain, clearError, ensureChain]
  );

  const getAdapterMetadata = useCallback(
    async (registryAddress: string, adapterAddress: string) => {
      if (!fallbackClient) throw new Error('Public client not available');
      return fallbackClient.readContract({
        address: registryAddress as Address,
        abi: ADAPTER_REGISTRY_ABI_TYPED,
        functionName: 'getAdapterMetadata',
        args: [adapterAddress as Address],
      });
    },
    [fallbackClient]
  );

  // Adapter Registry read functions
  const getAdapterRegistryInfo = useCallback(
    async (registryAddress: string, adapterAddress: string) => {
      if (!fallbackClient) throw new Error('Public client not available');
      return fallbackClient.readContract({
        address: registryAddress as Address,
        abi: ADAPTER_REGISTRY_ABI_TYPED,
        functionName: 'getAdapterInfo',
        args: [adapterAddress as Address],
      });
    },
    [fallbackClient]
  );

  const getAdaptersByType = useCallback(
    async (registryAddress: string, adapterType: number) => {
      if (!fallbackClient) throw new Error('Public client not available');
      return fallbackClient.readContract({
        address: registryAddress as Address,
        abi: ADAPTER_REGISTRY_ABI_TYPED,
        functionName: 'getAdaptersByType',
        args: [adapterType],
      });
    },
    [fallbackClient]
  );

  const getAllAdapters = useCallback(
    async (registryAddress: string) => {
      if (!fallbackClient) throw new Error('Public client not available');
      return fallbackClient.readContract({
        address: registryAddress as Address,
        abi: ADAPTER_REGISTRY_ABI_TYPED,
        functionName: 'getAllAdapters',
      });
    },
    [fallbackClient]
  );

  const isSelectable = useCallback(
    async (registryAddress: string, adapterAddress: string) => {
      if (!fallbackClient) throw new Error('Public client not available');
      return fallbackClient.readContract({
        address: registryAddress as Address,
        abi: ADAPTER_REGISTRY_ABI_TYPED,
        functionName: 'isSelectable',
        args: [adapterAddress as Address],
      });
    },
    [fallbackClient]
  );

  return {
    approveToken,
    createMarket,
    depositLiquidity,
    withdrawLiquidity,
    requestLoan,
    repay,
    liquidate,
    pauseMarket,
    unpauseMarket,
    registerAdapter,
    registerAdapterWithMetadata,
    getAdapterMetadata,
    getAdapterRegistryInfo,
    getAdaptersByType,
    getAllAdapters,
    isSelectable,
    isLoading,
    error,
    clearError,
  };
};
