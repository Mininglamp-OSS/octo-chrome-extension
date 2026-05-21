import { storage } from "wxt/utils/storage";
import { create } from "zustand";
import { useCurrentChannel } from "@/stores/currentChannel";

const KEY = "local:octo:extension:current-space" as const;
const spaceItem = storage.defineItem<string | null>(KEY, { fallback: null });

interface SpaceStore {
  currentSpaceId: string | null;
  hydrated: boolean;
  switchSpace: (id: string | null) => Promise<void>;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
}

export const useSpaceStore = create<SpaceStore>((set, get) => ({
  currentSpaceId: null,
  hydrated: false,

  async switchSpace(id) {
    if (get().currentSpaceId === id) return;
    try {
      await spaceItem.setValue(id);
    } catch {
      // ignore
    }
    set({ currentSpaceId: id });
    // 切 space 后聊天上下文应跟随重置：当前选中的会话/输入框退出
    useCurrentChannel.getState().clear();
  },

  async hydrate() {
    if (get().hydrated) return;
    try {
      const v = await spaceItem.getValue();
      set({ currentSpaceId: v, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  subscribe() {
    try {
      return spaceItem.watch((next: string | null) => {
        set({ currentSpaceId: next });
      });
    } catch {
      return () => {};
    }
  },
}));

export const selectCurrentSpaceId = (s: SpaceStore): string | null => s.currentSpaceId;
