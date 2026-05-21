import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { ConversationSyncResponseSchema } from "@/api/schemas/conversation";
import { type ConversationView, toConversationView } from "@/im/conversation";
import { onConversationsStale, onImMessage } from "@/im/proxy";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";

/**
 * conversation/sync —— sidepanel 直接 HTTP，按 X-Space-Id header（api/client.ts 注入）
 * 自动跟随 currentSpaceId。空间切换 / 新消息到达时 invalidate 重拉。
 *
 * mirror module.ts:289 等价：POST conversation/sync body { msg_count: 1 }
 */
export function conversationsQueryKey(spaceId: string | null) {
  return ["im", "conversations", spaceId] as const;
}

async function fetchConversations(): Promise<ConversationView[]> {
  const data = await api.post(Endpoints.conversations, { json: { msg_count: 1 } }).json();
  const parsed = ConversationSyncResponseSchema.parse(data);
  return (parsed.conversations ?? []).map(toConversationView);
}

export function useConversations() {
  const spaceId = useSpaceStore(selectCurrentSpaceId);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: conversationsQueryKey(spaceId),
    queryFn: fetchConversations,
    staleTime: 5_000,
  });

  // IM 推送 / offscreen 端"会话变更"信号 → invalidate 重拉。
  // 用 debounce 合并连续事件（一次 bot 回复可能推多条消息），避免被 server 限流。
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void qc.invalidateQueries({ queryKey: conversationsQueryKey(spaceId) });
      }, 500);
    };
    const offMsg = onImMessage(schedule);
    const offStale = onConversationsStale(schedule);
    return () => {
      if (timer) clearTimeout(timer);
      offMsg();
      offStale();
    };
  }, [qc, spaceId]);

  return query;
}
