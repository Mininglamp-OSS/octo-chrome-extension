import { storage } from "wxt/utils/storage";
import { create } from "zustand";

/** 用 wxt-storage 持久化，sidepanel 关闭再打开能恢复到上次对话 */
interface CurrentChannelValue {
  channelId: string | null;
  channelType: number;
}
const STORAGE_KEY = "local:octo:extension:current-channel" as const;
/** 导出供 cmdk iframe 等跨 entrypoint 复用，避免 key 字符串重复 */
export const currentChannelItem = storage.defineItem<CurrentChannelValue>(STORAGE_KEY, {
  fallback: { channelId: null, channelType: 0 },
});
const channelItem = currentChannelItem;

interface CurrentChannelStore {
  channelId: string | null;
  channelType: number;
  hydrated: boolean;
  select: (channelId: string, channelType: number) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
}

export const useCurrentChannel = create<CurrentChannelStore>((set, get) => ({
  channelId: null,
  channelType: 0,
  hydrated: false,
  select: (channelId, channelType) => {
    set({ channelId, channelType });
    void channelItem.setValue({ channelId, channelType }).catch(() => {});
  },
  clear: () => {
    set({ channelId: null, channelType: 0 });
    void channelItem.setValue({ channelId: null, channelType: 0 }).catch(() => {});
  },
  async hydrate() {
    if (get().hydrated) return;
    try {
      const v = await channelItem.getValue();
      set({ channelId: v.channelId, channelType: v.channelType, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
