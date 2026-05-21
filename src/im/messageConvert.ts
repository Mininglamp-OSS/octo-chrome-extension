import WKSDK, { Channel, Message, MessageStatus } from "wukongimjssdk";

/**
 * 把后端 `message/channel/sync` 返回的 raw 消息对象映射为 WKSDK Message 实例。
 * 与 mirror Convert.toMessage 行为对齐，但只保留 UI 需要的字段，省去 messageExtra / external 等。
 */

function jsonToUint8Array(obj: unknown): Uint8Array {
  const s = JSON.stringify(obj);
  // TextEncoder 在 sw/window/offscreen 都有
  return new TextEncoder().encode(s);
}

export interface RawSyncMessage {
  message_id?: number | string;
  message_idstr?: string;
  message_seq?: number;
  client_msg_no?: string;
  client_seq?: number;
  channel_id: string;
  channel_type: number;
  from_uid?: string;
  timestamp?: number;
  payload?: { type?: number } & Record<string, unknown>;
  revoke?: number;
  is_deleted?: number;
}

export function toSdkMessage(raw: RawSyncMessage): Message {
  const m = new Message();
  m.messageID = raw.message_idstr ?? String(raw.message_id ?? "");
  m.messageSeq = raw.message_seq ?? 0;
  m.clientMsgNo = raw.client_msg_no ?? "";
  if (typeof raw.client_seq === "number") m.clientSeq = raw.client_seq;
  m.channel = new Channel(raw.channel_id, raw.channel_type);
  m.fromUID = raw.from_uid ?? "";
  m.timestamp = raw.timestamp ?? 0;
  m.status = MessageStatus.Normal;
  if (raw.revoke === 1) m.remoteExtra.revoke = true;
  if (raw.is_deleted === 1) m.isDeleted = true;

  const payload = raw.payload;
  const contentType = payload?.type ?? 0;
  const content = WKSDK.shared().getMessageContent(contentType);
  if (payload) content.decode(jsonToUint8Array(payload));
  m.content = content;
  return m;
}
