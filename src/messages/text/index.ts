import { defineMessageType } from "@/messages/core/defineMessageType";
import { TEXT_TYPE, type TextContent, TextMessage } from "./TextMessage";

export type { TextContent };
export { TEXT_TYPE, TextMessage };

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
    if (m.replyInfo) out.replyInfo = m.replyInfo;
    return out;
  },
  fromUI: (data) => {
    const m = new TextMessage(data.text);
    m.setMention({
      all: data.mentionAll === true,
      uids: data.mentionUids ?? [],
      entities: data.mentionEntities ?? [],
    });
    if (data.replyInfo) m.replyInfo = data.replyInfo;
    return m;
  },
  digest: (data) => data.text,
  copyable: "text",
  mentionable: true,
  notifiable: true,
  countsAsUnread: true,
});
