import { create } from "zustand";
import { type AuthState, authStorage } from "@/platform/storage";

interface AuthStore {
  state: AuthState | null;
  hydrated: boolean;
  /** 写入新的登录信息（来自 /user/login 响应） */
  setAuth: (auth: AuthState) => Promise<void>;
  /** 清除（401 / 主动登出） */
  clear: () => Promise<void>;
  /** 从 wxt/storage 读出当前持久值并放到 store */
  hydrate: () => Promise<void>;
  /** 监听 storage 变化（其他 context 写入时自动同步） */
  subscribe: () => () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  state: null,
  hydrated: false,

  async setAuth(auth) {
    try {
      await authStorage.setValue(auth);
    } catch (err) {
      console.debug("[octo:auth] setAuth persist skipped", err);
    }
    set({ state: auth });
  },

  async clear() {
    try {
      await authStorage.setValue(null);
    } catch {
      // ignore
    }
    set({ state: null });
  },

  async hydrate() {
    if (get().hydrated) return;
    try {
      const v = await authStorage.getValue();
      set({ state: v, hydrated: true });
    } catch (err) {
      console.debug("[octo:auth] hydrate skipped (no chrome.storage)", err);
      set({ hydrated: true });
    }
  },

  subscribe() {
    try {
      return authStorage.watch((next: AuthState | null) => {
        set({ state: next });
      });
    } catch {
      return () => {};
    }
  },
}));

export const selectIsLogined = (s: AuthStore): boolean =>
  Boolean(s.state?.loggedIn && s.state.token);
export const selectToken = (s: AuthStore): string | undefined => s.state?.token;
export const selectUID = (s: AuthStore): string | undefined => s.state?.uid;
export const selectName = (s: AuthStore): string | undefined => s.state?.name;
