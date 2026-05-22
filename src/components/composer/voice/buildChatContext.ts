import type { Member } from "@/api/schemas/member";
import { ChannelType } from "@/const/channel";
import type { MessageView } from "@/im/message";

/**
 * 给 transcribe 接口的 chat_context + member_context 拼装。
 * 行为对齐 mirror Conversation/chatContext.ts：
 *
 * - memberContext = "聊天成员：A,B,C"
 *   - 群聊 ≤100 人：列全部 subscribers（去掉自己 + 已删除），name 与 remark 都不为空且不同时两者都列
 *   - 群聊 >100 人：只列「最近消息发送者」对应的成员，最多 100 个 uid（避免 prompt 过大）
 *   - 私聊：取对方 channelInfo.title + remark（这边不接 channelInfo，传 peer Member 即可）
 * - chatContext = 最近 10 条消息「[发送者名]: 文本」，换行 join；非文本消息略过 text
 */

export interface BuildChatContextParams {
  messages: MessageView[];
  members: Member[];
  channelType: number;
  loginUid: string;
  /** 私聊时对方的 Member（可选），用于 memberContext */
  peer?: Member;
}

export interface ChatContext {
  memberContext?: string;
  chatContext?: string;
}

const RECENT_LIMIT = 10;
const ACTIVE_UID_LIMIT = 100;
const SUBSCRIBER_FULL_LIMIT = 100;

function pushNames(out: string[], m: Pick<Member, "name" | "remark">): void {
  const name = m.name?.trim();
  const remark = m.remark?.trim();
  if (name) out.push(name);
  if (remark && remark !== name) out.push(remark);
}

function isDeleted(m: Member): boolean {
  // octo-ext Member 没有 isDeleted 字段；保守按 status === -1 视为已删除
  return m.status === -1;
}

function getMessageText(m: MessageView): string | undefined {
  // 只取文本类消息内容；其他类型走它们自己的 digest 也行，但 mirror 这里就只取 text
  const c = m.content;
  if (!c) return undefined;
  const data = c.data as { text?: unknown } | undefined;
  if (data && typeof data.text === "string") return data.text;
  return undefined;
}

export function buildChatContext(params: BuildChatContextParams): ChatContext {
  const { messages, members, channelType, loginUid, peer } = params;
  const out: ChatContext = {};

  // === memberContext ===
  const names: string[] = [];
  if (channelType === ChannelType.group) {
    if (members.length <= SUBSCRIBER_FULL_LIMIT) {
      for (const m of members) {
        if (m.uid === loginUid) continue;
        if (isDeleted(m)) continue;
        pushNames(names, m);
      }
    } else {
      const active = new Set<string>();
      for (let i = messages.length - 1; i >= 0 && active.size < ACTIVE_UID_LIMIT; i--) {
        const uid = messages[i]?.fromUid;
        if (uid && uid !== loginUid) active.add(uid);
      }
      for (const m of members) {
        if (active.has(m.uid) && !isDeleted(m)) pushNames(names, m);
      }
    }
  } else if (channelType === ChannelType.person) {
    if (peer) pushNames(names, peer);
  }
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length > 0) out.memberContext = `聊天成员：${unique.join(",")}`;

  // === chatContext ===
  if (messages.length > 0) {
    const recent = messages.slice(-RECENT_LIMIT);
    const uidToName = new Map<string, string>();
    for (const m of members) {
      const display = m.remark?.trim() || m.name?.trim();
      if (m.uid && display) uidToName.set(m.uid, display);
    }
    const lines: string[] = [];
    for (const m of recent) {
      const text = getMessageText(m);
      if (typeof text !== "string") continue;
      const sender = uidToName.get(m.fromUid) || m.fromUid;
      lines.push(`[${sender}]: ${text}`);
    }
    if (lines.length > 0) out.chatContext = lines.join("\n");
  }

  return out;
}
