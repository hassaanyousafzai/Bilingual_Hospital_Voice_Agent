"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/types";

interface UIState {
  language: Language;
  voiceEnabled: boolean;
  scenarioSample: string | null;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  setVoiceEnabled: (v: boolean) => void;
  setScenarioSample: (s: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      language: "en",
      voiceEnabled: true,
      scenarioSample: null,
      setLanguage: (language) => set({ language }),
      toggleLanguage: () => set({ language: get().language === "en" ? "ar" : "en" }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setScenarioSample: (scenarioSample) => set({ scenarioSample }),
    }),
    { name: "shifa-ui" }
  )
);
