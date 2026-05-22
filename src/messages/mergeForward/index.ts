import { defineMessageType } from "@/messages/core/defineMessageType";
import {
  MERGE_FORWARD_TYPE,
  MergeForwardMessage,
  type MergeForwardUser,
} from "./MergeForwardMessage";

export { MERGE_FORWARD_TYPE, MergeForwardMessage };
export type { MergeForwardUser };

/** UI 端持有的子消息形态：raw payload（含 type）+ 元数据。
 *  渲染时 lazy decode 重建 SDK 实例并走 MessageContentView 派发。
 *  这样既可跨 context 序列化，又避免 mergeForward 模块循环 import registry。 */
export interface MergeForwardSubUI {
  messageId: string;
  fromUid: string;
  timestamp: number;
  /** 含 type 字段的子消息原始 payload */
  payload: { type: number } & Record<string, unknown>;
}

export interface MergeForwardContent {
  title: string;
  channelType: number;
  users: MergeForwardUser[];
  msgs: MergeForwardSubUI[];
}

export const mergeForward = defineMessageType({
  type: MERGE_FORWARD_TYPE,
  name: "mergeForward" as const,
  category: "chat",
  sdkFactory: () => new MergeForwardMessage(),
  toUI: (raw) => {
    const m = raw as MergeForwardMessage;
    return {
      title: m.title,
      channelType: m.channelType,
      users: m.users,
      msgs: m.msgs.map((s) => ({
        messageId: s.messageId,
        fromUid: s.fromUid,
        timestamp: s.timestamp,
        payload: {
          type: s.content.contentType,
          ...s.rawPayload,
        },
      })),
    } satisfies MergeForwardContent;
  },
  fromUI: (data) => {
    const m = new MergeForwardMessage();
    // 走原生 decodeJSON 路径重建 .msgs（含 SDK 子实例 + rawPayload），保证 encode 链对称。
    m.decodeJSON({
      title: data.title,
      channel_type: data.channelType,
      users: data.users.map((u) => {
        const out: Record<string, unknown> = { uid: u.uid, name: u.name };
        if (u.isExternal) out.is_external = true;
        if (u.sourceSpaceName) out.source_space_name = u.sourceSpaceName;
        return out;
      }),
      msgs: data.msgs.map((s) => ({
        message_id: s.messageId,
        from_uid: s.fromUid,
        timestamp: s.timestamp,
        payload: s.payload,
      })),
    });
    return m;
  },
  digest: () => "[聊天记录]",
  copyable: "none",
  mentionable: false,
  notifiable: true,
  countsAsUnread: true,
});
