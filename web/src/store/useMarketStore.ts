import { create } from 'zustand';

interface MarketFormData {
  assetAddress: string;
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
