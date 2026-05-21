import { create } from "zustand";
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  preferencesStorage,
  type ThemeMode,
  themeStorage,
} from "@/platform/storage";

interface PrefStore {
  prefs: Preferences;
  theme: ThemeMode;
  hydrated: boolean;
  setPrefs: (patch: Partial<Preferences>) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
}

export const usePreferencesStore = create<PrefStore>((set, get) => ({
  prefs: DEFAULT_PREFERENCES,
  theme: "system",
  hydrated: false,

  async setPrefs(patch) {
    const next = { ...get().prefs, ...patch };
    try {
      await preferencesStorage.setValue(next);
    } catch {
      // ignore
    }
    set({ prefs: next });
  },

  async setTheme(theme) {
    try {
      await themeStorage.setValue(theme);
    } catch {
      // ignore
    }
    set({ theme });
  },

  async hydrate() {
    if (get().hydrated) return;
    try {
      const [p, t] = await Promise.all([preferencesStorage.getValue(), themeStorage.getValue()]);
      set({ prefs: p, theme: t, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  subscribe() {
    try {
      const off1 = preferencesStorage.watch((next: Preferences) => set({ prefs: next }));
      const off2 = themeStorage.watch((next: ThemeMode) => set({ theme: next }));
      return () => {
        off1();
        off2();
      };
    } catch {
      return () => {};
    }
  },
}));
