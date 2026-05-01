import { create } from 'zustand';

// Sepolia USDC — default loan asset for new markets
const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

interface MarketFormData {
  assetAddress: string;
  loanAssetAddress: string;
  ltv: number;
  apr: number;
  duration: number;
  liquidity: string;
}

interface MarketStore {
  step: number;
  formData: MarketFormData;
  setStep: (step: number) => void;
  setFormData: (data: Partial<MarketFormData>) => void;
  reset: () => void;
}

const INITIAL_DATA: MarketFormData = {
  assetAddress: "",
  loanAssetAddress: SEPOLIA_USDC,
  ltv: 75,
  apr: 12,
  duration: 30,
  liquidity: "",
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
