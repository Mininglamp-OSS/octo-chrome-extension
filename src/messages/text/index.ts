import { rehydrateContent } from "@/im/serialize";
import { defineMessageType } from "@/messages/core/defineMessageType";
import { getModuleOrUnknown, type SerializedContent } from "@/messages/core/registry";
import { type ReplyInfo, TEXT_TYPE, type TextContent, TextMessage } from "./TextMessage";

export type { ReplyInfo, TextContent };
export { TEXT_TYPE, TextMessage };

/** 把 reply.content（SDK 实例）通过 registry 派生 digest，所有消息类型通用 */
function deriveReplyDigest(content: unknown): string {
  if (!content || typeof content !== "object") return "[消息]";
  const type = (content as { contentType?: number }).contentType;
  if (typeof type !== "number") return "[消息]";
  const mod = getModuleOrUnknown(type);
  try {
    const data = mod.toUI(content as never);
    const d = mod.digest(data as never) || "";
    if (!d) return "[消息]";
    return d.length > 60 ? `${d.slice(0, 60)}…` : d;
  } catch {
    return "[消息]";
  }
}

/**
 * 文本消息 core 元数据：digest / sdkFactory / toUI / fromUI / 行为 flag。
 * Render（TextBubble + react-markdown 链）由 src/messages/renders.tsx 在 UI 端注册，
 * 避免 background SW 加载本模块时把 react-markdown / highlight.js 顶层访问 document
 * 的代码拽进 service worker bundle。
 */
export const text = defineMessageType({
  type: TEXT_TYPE,
  name: "text" as const,
  category: "chat",
  sdkFactory: () => new TextMessage(),
  toUI: (raw) => {
    const m = raw as TextMessage;
    const out: TextContent = { text: m.text };
    if (m.mentionUids.length) out.mentionUids = m.mentionUids;
    if (m.mentionAll) out.mentionAll = true;
    if (m.mentionEntities.length) out.mentionEntities = m.mentionEntities;
    if (m.replyInfo) {
      // digest 走 registry，所有消息类型（text/image/file/voice/sticker...）通用
      out.replyInfo = { ...m.replyInfo, digest: deriveReplyDigest(m.reply?.content) };
    }
    return out;
  },
  fromUI: (data) => {
    const m = new TextMessage(data.text);
    m.setMention({
      all: data.mentionAll === true,
      uids: data.mentionUids ?? [],
      entities: data.mentionEntities ?? [],
    });
    if (data.replyInfo) {
      // replyInfo.content 是发送链路传入的原 SerializedContent，rehydrate 成 SDK 内容塞给 Reply
      let replyContent: ReturnType<typeof rehydrateContent> | undefined;
      if (data.replyInfo.content) {
        try {
          replyContent = rehydrateContent(data.replyInfo.content as SerializedContent);
        } catch {
          replyContent = undefined;
        }
      }
      m.setReply({
        messageId: data.replyInfo.messageId,
        messageSeq: data.replyInfo.messageSeq,
        fromUid: data.replyInfo.fromUid,
        fromName: data.replyInfo.fromName,
        ...(replyContent && { content: replyContent }),
      });
    }
    return m;
  },
  digest: (data) => data.text,
  copyable: "text",
  mentionable: true,
  notifiable: true,
  countsAsUnread: true,
});
