import { create } from "zustand";

interface VipPrivileges {
  farmTrader: { enabled: boolean; maxRules: number; maxSpendPerDaySol: number };
  priceAlerts: { limit: number; fullOptions: boolean };
  skipAdsInQuests: boolean;
  energyCap: number;
  energyCapPlanned?: number | null;
  energyRegenMinutes: number;
  energyRegenMinutesPlanned?: number | null;
  feeDiscountPct: number;
}

interface AppState {
  user: string | null;
  wallet: string | null;
  isVip: boolean;
  vipPrivileges: VipPrivileges | null;
  energy: { amount: number; cap: number } | null;
  weather: any;
  onboarded: boolean;
  setUser: (user: string) => void;
  setWallet: (wallet: string) => void;
  setVip: (isVip: boolean, privileges?: VipPrivileges | null) => void;
  setEnergy: (energy: any) => void;
  setWeather: (weather: any) => void;
  setOnboarded: (v: boolean) => void;
}

const defaultPrivileges: VipPrivileges = {
  farmTrader: { enabled: false, maxRules: 1, maxSpendPerDaySol: 0.5 },
  priceAlerts: { limit: 1, fullOptions: false },
  skipAdsInQuests: false,
  energyCap: 20,
  energyCapPlanned: null,
  // Возврат энергии задаёт цепь: +1 за 30 минут (aof-core ENERGY_REGEN_SECONDS).
  energyRegenMinutes: 30,
  energyRegenMinutesPlanned: null,
  feeDiscountPct: 0,
};

export const useStore = create<AppState>((set) => ({
  user: null,
  wallet: null,
  isVip: false,
  vipPrivileges: defaultPrivileges,
  energy: null,
  weather: null,
  onboarded: false,
  setUser: (user) => set({ user }),
  setWallet: (wallet) => set({ wallet }),
  setVip: (isVip, privileges = null) =>
    set({ isVip, vipPrivileges: privileges || defaultPrivileges }),
  setEnergy: (energy) => set({ energy }),
  setWeather: (weather) => set({ weather }),
  setOnboarded: (onboarded) => set({ onboarded }),
}));
