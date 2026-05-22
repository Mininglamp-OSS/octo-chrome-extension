import { create } from "zustand";
import type { SerializedContent } from "@/messages/core/registry";

/**
 * 引用草稿。对照 mirror Conversation/index.tsx 发送路径：
 *   const reply = new Reply()
 *   reply.messageID / messageSeq / fromUID / fromName / content
 *   content.reply = reply
 *
 * 接收方 SDK Reply.decode 读 message_id / message_seq / from_uid / from_name / payload。
 * 我们这层抹掉 SDK 类型，存可序列化的 plain object。
 */
export interface ReplyDraft {
  messageId: string;
  messageSeq: number;
  fromUid: string;
  fromName: string;
  /** 原消息内容（projectMessage 投影），用于在 SDK Reply.encode 时还原成 payload */
  content: SerializedContent;
  /** 预览摘要，由 registry 模块的 digest 生成（截断处理） */
  digest: string;
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
