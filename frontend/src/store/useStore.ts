import { create } from "zustand";

import type { VipPrivileges } from "../lib/vipReadings";

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

export const useStore = create<AppState>((set) => ({
  user: null,
  wallet: null,
  isVip: false,
  vipPrivileges: null,
  energy: null,
  weather: null,
  onboarded: false,
  setUser: (user) => set({ user }),
  setWallet: (wallet) => set({ wallet }),
  setVip: (isVip, privileges = null) =>
    set({ isVip, vipPrivileges: isVip ? privileges : null }),
  setEnergy: (energy) => set({ energy }),
  setWeather: (weather) => set({ weather }),
  setOnboarded: (onboarded) => set({ onboarded }),
}));
