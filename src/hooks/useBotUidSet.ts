import { useMemo } from "react";
import { useFriends, useMyBots } from "@/api/queries/contacts";

/**
 * 汇集当前 space 内的「bot uid 集合」—— 用于在没有 bot 字段的列表项里（如 ConversationView、
 * Rail pin、SearchPopover）反查 channelId 是否是 AI 用户，从而展示 AiBadge。
 *
 * 数据来源（与 octo-web datasource 对齐）：
 *  - useFriends：friends 的 category === "bot" 或 robot === 1
 *  - useMyBots：当前 space 已添加的 bots（这些 uid 一定是 bot）
 *
 * 不做远程拉取（复用现有 cache），返回 stable Set 引用以减少下游 memo 失效。
 */
export function useBotUidSet(): Set<string> {
  const { data: friends } = useFriends();
  const { data: bots } = useMyBots();

  return useMemo(() => {
    const set = new Set<string>();
    for (const f of friends ?? []) {
      if (!f.uid) continue;
      if (
        f.category === "bot" ||
        f.robot === 1 ||
        (typeof f.bot_type === "number" && f.bot_type > 0)
      ) {
        set.add(f.uid);
      }
    }
    for (const b of bots ?? []) {
      if (b.uid) set.add(b.uid);
    }
    return set;
  }, [friends, bots]);
}
