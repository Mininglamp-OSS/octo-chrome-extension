import { create } from "zustand";

interface ThreadCtx {
  /** 子区 channelId（parent:thread 形式） */
  channelId: string;
  channelType: number;
  /** 父消息 channel + 标题（用于头部展示） */
  parentChannelId: string;
  parentChannelType: number;
  parentDigest: string;
}

interface ThreadStore {
  current: ThreadCtx | null;
  open: (ctx: ThreadCtx) => void;
  close: () => void;
}

export const useThreadStore = create<ThreadStore>((set) => ({
  current: null,
  open: (ctx) => set({ current: ctx }),
  close: () => set({ current: null }),
}));
