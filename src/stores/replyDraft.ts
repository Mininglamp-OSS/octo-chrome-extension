import { create } from "zustand";

interface ReplyDraft {
  messageId: string;
  from: string;
  text: string;
}

interface ReplyDraftStore {
  /** key 为 channelId:channelType */
  byChannel: Map<string, ReplyDraft>;
  set: (channelKey: string, draft: ReplyDraft) => void;
  clear: (channelKey: string) => void;
  get: (channelKey: string) => ReplyDraft | undefined;
}

export const useReplyDraft = create<ReplyDraftStore>((set, store) => ({
  byChannel: new Map(),
  set(channelKey, draft) {
    const map = new Map(store().byChannel);
    map.set(channelKey, draft);
    set({ byChannel: map });
  },
  clear(channelKey) {
    const map = new Map(store().byChannel);
    map.delete(channelKey);
    set({ byChannel: map });
  },
  get(channelKey) {
    return store().byChannel.get(channelKey);
  },
}));

export function channelKey(channelId: string, channelType: number): string {
  return `${channelId}:${channelType}`;
}
