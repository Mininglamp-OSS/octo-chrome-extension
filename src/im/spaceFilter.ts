import { ChannelType } from "@/const/channel";
import type { MessageView } from "@/im/message";

/** 全局系统 Bot：所有 space 都能看到会话条目，但消息按 space 隔离（mirror SpaceService）。 */
export const SYSTEM_BOTS = new Set(["botfather"]);

function isSystemBot(channelId: string): boolean {
  return SYSTEM_BOTS.has(channelId.toLowerCase());
}

/**
 * 对齐 mirror Conversation/vm.ts:filterPersonMessagesBySpace。
 * - 非 Person 频道：不过滤
 * - 无 currentSpaceId：不过滤（"全部"模式）
 * - msg.spaceId 等于当前 space → 保留
 * - msg.spaceId 不等于当前 space → 丢弃
 * - msg 无 spaceId（旧消息）：BotFather 丢弃（每 space 独立），普通私聊保留（向前兼容）
 */
export function shouldKeepPersonMessageForSpace(
  msg: Pick<MessageView, "channelId" | "channelType" | "spaceId">,
  currentSpaceId: string | null,
): boolean {
  if (msg.channelType !== ChannelType.person) return true;
  if (!currentSpaceId) return true;
  if (msg.spaceId) return msg.spaceId === currentSpaceId;
  return !isSystemBot(msg.channelId);
}
