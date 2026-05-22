import { ChannelType } from "@/const/channel";
import type { MergeForwardContent } from "./index";

/**
 * 合并转发卡片 / 详情面板标题。优先级（对照 mirror Mergeforward/index.tsx getTitle）：
 *   1. content.title（后端下发）
 *   2. group → 固定「群的聊天记录」（payload 里没有群名，不能用 users 拼）
 *   3. person → users.name 用 "、" 拼接 + "的聊天记录"
 *   4. 兜底「聊天记录」
 */
export function mergeForwardTitle(c: MergeForwardContent): string {
  const t = c.title?.trim();
  if (t) return t;
  if (c.channelType === ChannelType.group) return "群的聊天记录";
  const names = c.users
    .map((u) => u.name)
    .filter(Boolean)
    .slice(0, 3);
  if (names.length) return `${names.join("、")} 的聊天记录`;
  return "聊天记录";
}
