import { create } from "zustand";

interface AtMeStore {
  /** channelKey -> count of unread @我 messages */
  counts: Map<string, number>;
  bump: (channelKey: string) => void;
  clear: (channelKey: string) => void;
  get: (channelKey: string) => number;
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
}));

export function atMeKey(channelId: string, channelType: number): string {
  return `${channelId}:${channelType}`;
}
