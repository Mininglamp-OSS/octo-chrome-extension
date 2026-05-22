import { MessageContent as WKMessageContent, WKSDK } from "wukongimjssdk";

export const MERGE_FORWARD_TYPE = 11 as const;

/** decode 阶段子消息递归层数上限，防爆栈。mirror 同值 8。 */
const MAX_DECODE_DEPTH = 8;

export interface MergeForwardUser {
  uid: string;
  name: string;
  /** 外部成员标记（透传） */
  isExternal?: boolean;
  sourceSpaceName?: string;
}

export interface MergeForwardSubMessage {
  messageId: string;
  fromUid: string;
  timestamp: number;
  /** 解码后的 SDK 子内容实例；contentType 从这里读 */
  content: WKMessageContent;
  /** 原始 payload（含 type 字段），UI 跨 context 序列化 / fromUI rehydrate 用 */
  rawPayload: Record<string, unknown>;
}

/**
 * 合并转发消息 SDK 子类（仅接收侧）。
 * Payload 结构（对照 octo-web / mirror）：
 *   {
 *     "type": 11,
 *     "title": "...",
 *     "channel_type": 2,
 *     "users": [{ "uid", "name", "is_external"?, "source_space_name"? }],
 *     "msgs":  [{ "message_id", "from_uid", "timestamp",
 *                  "payload": { "type": <int>, ...sub fields } }]
 *   }
 *
 * decodeJSON 阶段对每条 sub.payload 通过 WKSDK.shared().getMessageContent(type) 拿到对应
 * SDK 子类并 decode（递归）。深度超过 MAX_DECODE_DEPTH 时把子消息按原样存为 rawPayload 但
 * content 退化为空的 MergeForwardMessage 标题占位，避免无限栈。
 */
export class MergeForwardMessage extends WKMessageContent {
  title = "";
  channelType = 0;
  users: MergeForwardUser[] = [];
  msgs: MergeForwardSubMessage[] = [];

  override get contentType(): number {
    return MERGE_FORWARD_TYPE;
  }

  override decodeJSON(content: Record<string, unknown>): void {
    decodeInto(this, content, 0);
  }

  override encodeJSON(): Record<string, unknown> {
    return {
      title: this.title,
      channel_type: this.channelType,
      users: this.users.map((u) => {
        const out: Record<string, unknown> = { uid: u.uid, name: u.name };
        if (u.isExternal) out.is_external = true;
        if (u.sourceSpaceName) out.source_space_name = u.sourceSpaceName;
        return out;
      }),
      msgs: this.msgs.map((m) => ({
        message_id: m.messageId,
        from_uid: m.fromUid,
        timestamp: m.timestamp,
        payload: m.rawPayload,
      })),
    };
  }
}

function decodeInto(target: MergeForwardMessage, content: Record<string, unknown>, depth: number): void {
  target.title = typeof content.title === "string" ? content.title : "";
  target.channelType = Number(content.channel_type ?? 0);
  target.users = parseUsers(content.users);
  target.msgs = parseMsgs(content.msgs, depth);
}

function parseUsers(raw: unknown): MergeForwardUser[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: MergeForwardUser[] = [];
  for (const u of raw) {
    if (!u || typeof u !== "object") continue;
    const o = u as Record<string, unknown>;
    const uid = String(o.uid ?? "");
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    const user: MergeForwardUser = { uid, name: String(o.name ?? "") };
    if (o.is_external) user.isExternal = true;
    if (typeof o.source_space_name === "string") user.sourceSpaceName = o.source_space_name;
    out.push(user);
  }
  return out;
}

function parseMsgs(raw: unknown, depth: number): MergeForwardSubMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: MergeForwardSubMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    const payload = o.payload;
    if (!payload || typeof payload !== "object") continue;
    const p = payload as Record<string, unknown>;
    const subType = Number(p.type ?? 0);
    const sdk = decodeSub(subType, p, depth);
    if (!sdk) continue;
    out.push({
      messageId: String(o.message_id ?? ""),
      fromUid: String(o.from_uid ?? ""),
      timestamp: Number(o.timestamp ?? 0),
      content: sdk,
      rawPayload: p,
    });
  }
  return out;
}

function decodeSub(
  type: number,
  payload: Record<string, unknown>,
  depth: number,
): WKMessageContent | null {
  try {
    const instance = WKSDK.shared().getMessageContent(type);
    if (instance instanceof MergeForwardMessage) {
      if (depth + 1 >= MAX_DECODE_DEPTH) {
        instance.title = instance.title || "[嵌套层数过多]";
        return instance;
      }
      decodeInto(instance, payload, depth + 1);
    } else {
      instance.decodeJSON(payload);
    }
    return instance;
  } catch {
    return null;
  }
}
