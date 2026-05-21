import { create } from "zustand";

/** 简化版 TypingManager —— 记录每个 channel 当前有谁在输入 */

interface TypingEntry {
  uid: string;
  expiresAt: number;
}

interface TypingStore {
  byChannel: Map<string, TypingEntry[]>;
  mark: (channelKey: string, uid: string, ttlMs?: number) => void;
  clear: (channelKey: string, uid?: string) => void;
  who: (channelKey: string) => string[];
}

export const useTypingStore = create<TypingStore>((set, get) => ({
  byChannel: new Map(),

  mark(channelKey, uid, ttlMs = 5000) {
    const map = new Map(get().byChannel);
    const existing = map.get(channelKey) ?? [];
    const filtered = existing.filter((e) => e.uid !== uid);
    filtered.push({ uid, expiresAt: Date.now() + ttlMs });
    map.set(channelKey, filtered);
    set({ byChannel: map });
  },

  clear(channelKey, uid) {
    const map = new Map(get().byChannel);
    if (uid == null) {
      map.delete(channelKey);
    } else {
      const existing = map.get(channelKey) ?? [];
      map.set(
        channelKey,
        existing.filter((e) => e.uid !== uid),
      );
    }
    set({ byChannel: map });
  },

  who(channelKey) {
    const now = Date.now();
    const list = get().byChannel.get(channelKey) ?? [];
    return list.filter((e) => e.expiresAt > now).map((e) => e.uid);
  },
}));
