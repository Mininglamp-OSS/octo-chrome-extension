import type { Message } from "wukongimjssdk";
import { getModuleOrUnknown } from "@/messages/core/registry";
import type { SerializedContent } from "@/platform/messaging";

/** 把 WKSDK 的 Message 投影成跨 context 可序列化的 plain object */
export function projectMessage(m: Message): SerializedContent {
  const mod = getModuleOrUnknown(m.content.contentType);
  return { type: mod.type, data: mod.toUI(m.content) } as SerializedContent;
}

export interface MessageView {
  messageId: string;
  messageSeq: number;
  clientMsgNo?: string;
  fromUid: string;
  channelId: string;
  channelType: number;
  timestamp: number;
  content: SerializedContent;
  /** 是否已撤回（撤回后渲染灰 pill 占位） */
  revoked?: boolean;
  /** 撤回人 uid */
  revoker?: string;
  /** sendack reasonCode != 0，UI 显示发送失败 */
  sendFailed?: boolean;
  /** sendack reasonCode（自己发的消息有意义） */
  reasonCode?: number;
  /** 服务端 payload.space_id —— Person/BotFather 跨 space 过滤用（mirror filterPersonMessagesBySpace） */
  spaceId?: string;
}

export function toMessageView(m: Message): MessageView {
  const revoke = m.remoteExtra?.revoke === true;
  const revoker = m.remoteExtra?.revoker;
  const spaceId = (m.content as { contentObj?: { space_id?: unknown } } | undefined)?.contentObj
    ?.space_id;
  return {
    messageId: m.messageID,
    messageSeq: m.messageSeq,
    clientMsgNo: m.clientMsgNo,
    fromUid: m.fromUID,
    channelId: m.channel.channelID,
    channelType: m.channel.channelType,
    timestamp: m.timestamp,
    content: projectMessage(m),
    ...(revoke && { revoked: true }),
    ...(revoker && { revoker }),
    ...(typeof spaceId === "string" && spaceId && { spaceId }),
  };
}
