import { create } from "zustand";

interface AtMeStore {
  /** channelKey -> count of unread @我 messages */
  counts: Map<string, number>;
  bump: (channelKey: string) => void;
  clear: (channelKey: string) => void;
  get: (channelKey: string) => number;
  /** 从 storage 全量替换内存 map —— 用于 sidepanel mount 时 hydrate 与 storage watch */
  hydrate: (next: Map<string, number>) => void;
}

export const useAtMeStore = create<AtMeStore>((set, store) => ({
  counts: new Map(),
  bump(channelKey) {
    const map = new Map(store().counts);
    map.set(channelKey, (map.get(channelKey) ?? 0) + 1);
    set({ counts: map });
  },
  clear(channelKey) {
    const map = new Map(store().counts);
    if (map.delete(channelKey)) set({ counts: map });
  },
  get(channelKey) {
    return store().counts.get(channelKey) ?? 0;
  },
  hydrate(next) {
    // 直接替换；若内容与当前完全相同则跳过 set 避免无谓 rerender
    const cur = store().counts;
    if (cur.size === next.size) {
      let same = true;
      for (const [k, v] of next) {
        if (cur.get(k) !== v) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    set({ counts: new Map(next) });
  },
}));

export function atMeKey(channelId: string, channelType: number): string {
  return `${channelId}:${channelType}`;
}
