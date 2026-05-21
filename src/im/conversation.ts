import type { Reminder } from "wukongimjssdk";
import WKSDK from "wukongimjssdk";
import type { Conversation as ApiConversation } from "@/api/schemas/conversation";
import { ChannelType } from "@/const/channel";
import { getModuleOrUnknown } from "@/messages/core/registry";

/**
 * ConversationWrap 的轻量等价物 —— 纯数据 + 工具函数。
 * 不继承 React.Component，UI 通过 selector 派生需要的字段。
 */

export interface ConversationView {
  channelId: string;
  channelType: number;
  name: string;
  avatar?: string;
  unread: number;
  timestamp: number;
  pinned: boolean;
  /** 最后一条消息摘要（已 conversationDigest 化） */
  lastDigest: string;
  /** 服务端 reminder (un-done) 数量；@ 提及等都汇总到这里 */
  mentionCount: number;
  /** 最后一条消息的 messageSeq —— 用作 fetchHistory 首次 startMessageSeq（mirror conversationLastMessageSeq） */
  lastMessageSeq?: number;
}

export function toConversationView(api: ApiConversation): ConversationView {
  // mirror Model.tsx:get lastMessage —— Person 频道优先用后端 per-space 的 space_last_message
  // （比如 BotFather 在每个 space 里的最新一条，对应当前 space），否则回落到全局 recents[0]。
  const recent0 = (api.recents?.[0] ?? null) as { payload?: unknown; message_seq?: number } | null;
  const spaceLast = api.space_last_message as
    | { payload?: unknown; message_seq?: number }
    | undefined
    | null;
  const isPerson = api.channel_type === ChannelType.person;
  const preferredLast = isPerson && spaceLast ? spaceLast : recent0;
  return {
    channelId: api.channel_id,
    channelType: api.channel_type,
    // 后端 conversation/sync 不返回 name —— 名字走 channelInfo（rail/list 已各自处理）
    name: api.channel_id,
    unread: api.unread ?? 0,
    timestamp: api.timestamp ?? 0,
    pinned: api.stick === 1,
    lastDigest: digestOf(preferredLast?.payload),
    mentionCount: 0,
    ...(typeof preferredLast?.message_seq === "number" &&
      preferredLast.message_seq > 0 && { lastMessageSeq: preferredLast.message_seq }),
  };
}

function digestOf(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as { type?: number };
  const type = typeof p.type === "number" ? p.type : 0;
  // 先用 SDK 解码 raw payload → SDK 实例（factor 兜底覆盖 1000-2000 系统消息）
  const sdk = WKSDK.shared().getMessageContent(type);
  try {
    sdk.decodeJSON(p as Record<string, unknown>);
  } catch {
    // 解码失败：返回空 digest 而非抛错
    return "";
  }
  const mod = getModuleOrUnknown(type);
  try {
    return mod.digest(mod.toUI(sdk));
  } catch {
    return "";
  }
}

export function sortConversations(list: ConversationView[]): ConversationView[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.timestamp - a.timestamp;
  });
}

/** 用于跳过非当前 Space 的会话（mirror 行为：shouldSkipChannelForSpace） */
export function shouldSkipForSpace(
  conv: ConversationView,
  currentSpaceId: string | null,
  channelSpace: Map<string, string | null>,
): boolean {
  // person 会话不绑定 space，永远显示
  if (conv.channelType === ChannelType.person) return false;
  if (!currentSpaceId) return false;
  const key = `${conv.channelId}_${conv.channelType}`;
  const space = channelSpace.get(key);
  return space != null && space !== currentSpaceId;
}

const REMINDER_CHANNEL_TYPES = new Set<number>([ChannelType.group, ChannelType.communityTopic]);

/** 从一批会话里挑出需要同步 reminder 的 channel_ids（仅 group / communityTopic） */
export function collectReminderChannelIds(convs: ConversationView[]): string[] {
  const out: string[] = [];
  for (const c of convs) {
    if (REMINDER_CHANNEL_TYPES.has(c.channelType)) out.push(c.channelId);
  }
  return out;
}

/** 把 reminder 列表汇成 channelKey -> undone count 并应用到 ConversationView 列表（不可变更新） */
export function applyReminderCounts(
  convs: ConversationView[],
  reminders: Reminder[],
): ConversationView[] {
  const counts = new Map<string, number>();
  for (const r of reminders) {
    if (r.done) continue;
    const key = `${r.channel.channelID}:${r.channel.channelType}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return convs.map((c) => {
    const k = `${c.channelId}:${c.channelType}`;
    const m = counts.get(k) ?? 0;
    return m === c.mentionCount ? c : { ...c, mentionCount: m };
  });
}
