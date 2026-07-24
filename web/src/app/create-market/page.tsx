'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMarketStore, WIZARD_STEPS } from '@/store/useMarketStore';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { AdapterSelector } from '@/components/adapters/AdapterSelector';
import { useContractInteraction } from '@/hooks/useContractInteraction';

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_FACTORY_V2_ADDRESS || '';

const ADAPTERS = {
  asset: [
    { address: process.env.NEXT_PUBLIC_ERC20_ADAPTER_WETH || '0xBc09566675D50d7622545CBA2eD5D135Ae52e578', name: 'ERC20Adapter (WETH)', type: 0, verified: true, deprecated: false },
    { address: process.env.NEXT_PUBLIC_ERC20_ADAPTER_USDC || '0xd0448DE8c5bCA1B8f17359F28F301EADC4F4CBc3', name: 'ERC20Adapter (USDC)', type: 0, verified: true, deprecated: false },
  ],
  oracle: [
    { address: process.env.NEXT_PUBLIC_CHAINLINK_ADAPTER || '', name: 'ChainlinkAdapter', type: 1, verified: true, deprecated: false },
  ],
  liquidation: [
    { address: process.env.NEXT_PUBLIC_DEX_SWAP_LIQUIDATION_ADAPTER || '0x0615642340e70f0a48BC1BCB8bfb5551Ec055Fec', name: 'DEXSwapLiquidationAdapter', type: 3, verified: true, deprecated: false },
    { address: process.env.NEXT_PUBLIC_NFT_AUCTION_LIQUIDATION_ADAPTER || '0x2910b2f6851A210453CB43ED4E3A9fF7E138d881', name: 'NFTAuctionLiquidationAdapter', type: 3, verified: true, deprecated: false },
  ],
  position: [
    { address: process.env.NEXT_PUBLIC_STANDARD_POSITION_ADAPTER || '0x3D1F31C4AA2419184d6A56367816cE892167AFfE', name: 'StandardPositionAdapter', type: 4, verified: true, deprecated: false, auditReference: 'Internal audit #1' },
    { address: process.env.NEXT_PUBLIC_SOULBOUND_POSITION_ADAPTER || '0xE24E121F044aDeaE9a5224c0b1Ea4aD79BF0F1Ce', name: 'SoulboundPositionAdapter', type: 4, verified: true, deprecated: false, auditReference: 'Internal audit #1' },
    { address: process.env.NEXT_PUBLIC_TRANSFERABLE_POSITION_ADAPTER || '0xF1a56c7D0485476AF12B93AEbc6d769D449ebb66', name: 'TransferablePositionAdapter', type: 4, verified: true, deprecated: false, auditReference: 'Internal audit #1' },
  ],
};

export default function CreateMarketPage() {
  const router = useRouter();
  const { address: userAddress } = useAccount();
  const { step, formData, setStep, setFormData, reset } = useMarketStore();
  const { createMarket, isLoading, error: hookError, clearError } = useContractInteraction();
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => setStep(Math.min(step + 1, 8));
  const handleBack = () => setStep(Math.max(step - 1, 1));

  const handleDeploy = async () => {
    if (!userAddress) { setError('Please connect your wallet'); return; }
    if (!FACTORY_ADDRESS) { setError('Factory address not configured'); return; }

    setIsDeploying(true);
    setError(null);

    try {
      const durationSeconds = formData.duration * 86400;
      const config = {
        lpAddress: userAddress,
        collateralAsset: formData.collateralAsset,
        assetAdapter: formData.assetAdapter,
        oracleAdapter: formData.oracleAdapter,
        complianceAdapter: formData.enableCompliance ? formData.complianceAdapter : '0x0000000000000000000000000000000000000000',
        liquidationAdapter: formData.liquidationAdapter,
        positionAdapter: formData.positionAdapter,
        lendingAsset: formData.lendingAsset,
        ltvBasisPoints: BigInt(Math.round(formData.ltv * 100)),
        aprBasisPoints: BigInt(Math.round(formData.apr * 100)),
        durationSeconds: BigInt(durationSeconds),
        gracePeriodHours: BigInt(formData.gracePeriod),
        enableHealthFactor: formData.enableHealthFactor,
        healthFactorThreshold: BigInt(Math.round(formData.healthFactorThreshold * 100)),
        enableCircuitBreaker: formData.enableCircuitBreaker,
        pauseThresholdBps: BigInt(formData.pauseThresholdBps),
        lookbackPeriodSeconds: BigInt(formData.lookbackPeriodSeconds),
        resumeThresholdBps: BigInt(formData.resumeThresholdBps),
        cooldownSeconds: BigInt(formData.cooldownSeconds),
      };

      // Parse initial liquidity (USDC = 6 decimals)
      const initialLiquidity = formData.liquidity
        ? parseUnits(formData.liquidity, 6)
        : BigInt(0);

      setTxHash('pending...');
      const result = await createMarket(config, FACTORY_ADDRESS, initialLiquidity);
      setTxHash(result.txHash);
      setTimeout(() => {
        reset();
        router.push('/markets');
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const progress = (step / 8) * 100;

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <h1 className="mb-2 text-2xl font-bold text-white">Create Lending Market</h1>
        <p className="mb-8 text-sm text-zinc-400">Configure your isolated lending market with pluggable adapters</p>

        {/* Progress bar */}
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="mb-6 text-xs text-zinc-500">Step {step} of 8: {WIZARD_STEPS[step - 1].label}</p>

        {/* Step content */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Collateral Asset</h2>
              <p className="text-sm text-zinc-400">Select the collateral token and asset adapter for this market.</p>
              <div>
                <label className="block text-sm font-medium text-zinc-200">Collateral Token Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={formData.collateralAsset}
                  onChange={(e) => setFormData({ collateralAsset: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <AdapterSelector
                label="Asset Adapter"
                description="Handles collateral custody (escrow/release)"
                adapters={ADAPTERS.asset}
                selected={formData.assetAdapter}
                onSelect={(addr) => setFormData({ assetAdapter: addr })}
                required
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Oracle</h2>
              <p className="text-sm text-zinc-400">Select the price oracle for this market. TWAP recommended for crypto; Chainlink for RWA.</p>
              <AdapterSelector
                label="Oracle Adapter"
                description="Provides collateral price feeds with trust signal"
                adapters={ADAPTERS.oracle}
                selected={formData.oracleAdapter}
                onSelect={(addr) => setFormData({ oracleAdapter: addr })}
                required
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Compliance</h2>
              <p className="text-sm text-zinc-400">Optional — enable compliance checks for borrower eligibility.</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFormData({ enableCompliance: !formData.enableCompliance })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableCompliance ? 'bg-blue-500' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableCompliance ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <span className="text-sm text-zinc-200">Enable Compliance Adapter</span>
              </div>
              {formData.enableCompliance && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-400">
                  No compliance adapter deployed yet. Disable compliance or deploy one first.
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Liquidation</h2>
              <p className="text-sm text-zinc-400">How defaults are resolved. Async adapters (issuer redemption) require compliance.</p>
              <AdapterSelector
                label="Liquidation Adapter"
                description="How defaults are resolved. Async adapters (issuer redemption) require compliance."
                adapters={ADAPTERS.liquidation}
                selected={formData.liquidationAdapter}
                onSelect={(addr) => setFormData({ liquidationAdapter: addr })}
                required
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Position</h2>
              <p className="text-sm text-zinc-400">How loan positions are represented and tracked.</p>
              <AdapterSelector
                label="Position Adapter"
                description="Standard: cheapest gas. Soulbound: non-transferable NFT. Transferable: sellable position."
                adapters={ADAPTERS.position}
                selected={formData.positionAdapter}
                onSelect={(addr) => setFormData({ positionAdapter: addr })}
                required
              />
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Risk Parameters</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-200">LTV (%)</label>
                  <input type="number" value={formData.ltv} onChange={(e) => setFormData({ ltv: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-zinc-200">APR (%)</label>
                  <input type="number" value={formData.apr} onChange={(e) => setFormData({ apr: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-zinc-200">Duration (days)</label>
                  <input type="number" value={formData.duration} onChange={(e) => setFormData({ duration: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-zinc-200">Grace Period (hours)</label>
                  <input type="number" value={formData.gracePeriod} onChange={(e) => setFormData({ gracePeriod: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setFormData({ enableHealthFactor: !formData.enableHealthFactor })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableHealthFactor ? 'bg-blue-500' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableHealthFactor ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <span className="text-sm text-zinc-200">Enable Health Factor ({formData.healthFactorThreshold}%)</span>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Lending Asset & Liquidity</h2>
              <p className="text-sm text-zinc-400">Select the stablecoin for lending and provide initial liquidity.</p>
              <div>
                <label className="block text-sm text-zinc-200">Lending Asset (Stablecoin)</label>
                <input type="text" value={formData.lendingAsset} onChange={(e) => setFormData({ lendingAsset: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-zinc-200">Initial Liquidity (tokens)</label>
                <input type="text" placeholder="1000" value={formData.liquidity} onChange={(e) => setFormData({ liquidity: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Deploy</h2>
              <p className="text-sm text-zinc-400">Review your configuration and deploy the market.</p>
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 text-sm space-y-2">
                <div className="flex justify-between"><span className="text-zinc-400">Collateral:</span><span className="text-white">{formData.collateralAsset.slice(0, 10)}...</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Oracle:</span><span className="text-white">{formData.oracleAdapter.slice(0, 10)}...</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Compliance:</span><span className="text-white">{formData.enableCompliance ? 'Enabled' : 'Disabled'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Liquidation:</span><span className="text-white">{formData.liquidationAdapter.slice(0, 10)}...</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Position:</span><span className="text-white">{formData.positionAdapter.slice(0, 10)}...</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">LTV:</span><span className="text-white">{formData.ltv}%</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">APR:</span><span className="text-white">{formData.apr}%</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Duration:</span><span className="text-white">{formData.duration} days</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Lending Asset:</span><span className="text-white">{formData.lendingAsset.slice(0, 10)}...</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Liquidity:</span><span className="text-white">{formData.liquidity} tokens</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">{error}</div>
        )}

        {/* TX Hash */}
        {txHash && (
          <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-400">
            {txHash}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          {step > 1 ? (
            <button onClick={handleBack} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Back</button>
          ) : <div />}
          {step < 8 ? (
            <button onClick={handleNext} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">Continue</button>
          ) : (
            <button onClick={handleDeploy} disabled={isDeploying || !FACTORY_ADDRESS} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
              {isDeploying ? 'Deploying...' : 'Deploy Market'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
