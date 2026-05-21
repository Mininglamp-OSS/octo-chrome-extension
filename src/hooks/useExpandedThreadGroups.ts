import { useEffect, useState } from "react";
import { storage } from "wxt/utils/storage";

/**
 * mirror ConversationList:_storageKey/_toggleGroupExpand 等价：
 * 持久化"哪些群展开了子区"的 Set。简化为全局（mirror 按 uid+spaceId 隔离）。
 */
const KEY = "local:octo:extension:expanded-thread-groups" as const;
const item = storage.defineItem<string[]>(KEY, { fallback: [] });

export function useExpandedThreadGroups(): {
  isExpanded: (groupNo: string) => boolean;
  toggle: (groupNo: string) => void;
} {
  const [set, setSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void item.getValue().then((arr) => {
      if (!cancelled) setSet(new Set(arr));
    });
    const stop = item.watch((next) => setSet(new Set(next)));
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  function toggle(groupNo: string): void {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(groupNo)) next.delete(groupNo);
      else next.add(groupNo);
      void item.setValue(Array.from(next)).catch(() => {});
      return next;
    });
  }

  return {
    isExpanded: (g) => set.has(g),
    toggle,
  };
}

/**
 * mirror Thread.ts:parseThreadChannelId — communityTopic 的 channelId 形如
 * `${parentGroupNo}____${shortId}`，"____" 是固定分隔符。
 */
const SEP = "____";
export function parseParentGroupNo(threadChannelId: string): string | null {
  const i = threadChannelId.indexOf(SEP);
  if (i <= 0) return null;
  return threadChannelId.slice(0, i);
}
