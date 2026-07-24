import { create } from 'zustand';

const BASE_SEPOLIA_USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export interface MarketFormData {
  // Step 1: Collateral Asset
  collateralAsset: string;
  assetAdapter: string;

  // Step 2: Oracle
  oracleAdapter: string;

  // Step 3: Compliance (optional)
  enableCompliance: boolean;
  complianceAdapter: string;

  // Step 4: Liquidation
  liquidationAdapter: string;

  // Step 5: Position
  positionAdapter: string;

  // Step 6: Risk Parameters
  ltv: number;
  apr: number;
  duration: number;
  gracePeriod: number;
  enableHealthFactor: boolean;
  healthFactorThreshold: number;
  enableCircuitBreaker: boolean;
  pauseThresholdBps: number;
  lookbackPeriodSeconds: number;
  resumeThresholdBps: number;
  cooldownSeconds: number;

  // Step 7: Lending Asset & Liquidity
  lendingAsset: string;
  liquidity: string;

  // Step 8: Deploy (computed)
}

interface MarketStore {
  step: number;
  formData: MarketFormData;
  setStep: (step: number) => void;
  setFormData: (data: Partial<MarketFormData>) => void;
  reset: () => void;
}

const INITIAL_DATA: MarketFormData = {
  collateralAsset: '',
  assetAdapter: '',
  oracleAdapter: '',
  enableCompliance: false,
  complianceAdapter: '',
  liquidationAdapter: '',
  positionAdapter: '',
  ltv: 75,
  apr: 12,
  duration: 30,
  gracePeriod: 1,
  enableHealthFactor: true,
  healthFactorThreshold: 120,
  enableCircuitBreaker: true,
  pauseThresholdBps: 2000,
  lookbackPeriodSeconds: 3600,
  resumeThresholdBps: 1000,
  cooldownSeconds: 7200,
  lendingAsset: BASE_SEPOLIA_USDC,
  liquidity: '',
};

export const useMarketStore = create<MarketStore>((set) => ({
  step: 1,
  formData: INITIAL_DATA,
  setStep: (step) => set({ step }),
  setFormData: (data) =>
    set((state) => ({
      formData: { ...state.formData, ...data },
    })),
  reset: () => set({ step: 1, formData: INITIAL_DATA }),
}));

// Step labels for the wizard progress bar
export const WIZARD_STEPS = [
  { num: 1, label: 'Collateral Asset' },
  { num: 2, label: 'Oracle' },
  { num: 3, label: 'Compliance' },
  { num: 4, label: 'Liquidation' },
  { num: 5, label: 'Position' },
  { num: 6, label: 'Risk Parameters' },
  { num: 7, label: 'Lending & Liquidity' },
  { num: 8, label: 'Deploy' },
] as const;
