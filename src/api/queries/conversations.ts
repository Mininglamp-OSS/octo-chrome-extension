import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import WKSDK from "wukongimjssdk";
import { api } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { ConversationSyncResponseSchema } from "@/api/schemas/conversation";
import { applyReminderCounts, type ConversationView, toConversationView } from "@/im/conversation";
import {
  ConnectStatus,
  imSyncReminders,
  onConversationsStale,
  onImMessage,
  onImStatus,
} from "@/im/proxy";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";

/**
 * conversation/sync —— sidepanel 直接 HTTP，按 X-Space-Id header（api/client.ts 注入）
 * 自动跟随 currentSpaceId。空间切换 / 新消息到达时 invalidate 重拉。
 *
 * mirror module.ts:289 等价：POST conversation/sync body { msg_count: 1 }
 *
 * mentionCount 来源：服务端 conversation/sync 不带 mention，靠 SDK reminderManager.sync()
 * 拉到本地 reminders 数组后合并。三个时机触发 sync：
 *  1. sidepanel 首次 mount（重开时拿历史 @）
 *  2. SDK Connected（重连后服务端可能有新 reminder）
 *  3. 收到任何新消息（debounce 500ms，新消息往往伴随 reminder 推送）
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

  // reminderTick：reminderManager.reminders 数组内容变化时 +1，触发 useMemo 重算
  const [reminderTick, setReminderTick] = useState(0);

  // === conversation 刷新：onImMessage / onConversationsStale → invalidate（debounce 500ms）
  // 注意：**不要在这里调 syncReminders**，因为 syncReminders 内部会
  // fireConversationsStale 触发本订阅，形成死循环。
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

  // === reminder 同步：单独 effect，跟 conversation invalidate 解耦
  // mount + onImMessage（debounce 1s）+ Connected 时调，不订阅 onConversationsStale
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sync = () => {
      void imSyncReminders().then(() => setReminderTick((t) => t + 1));
    };
    const debouncedSync = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        sync();
      }, 1_000);
    };
    sync(); // mount 时立刻一次
    const offMsg = onImMessage(debouncedSync);
    const offStatus = onImStatus((s) => {
      if (s === ConnectStatus.Connected) sync();
    });
    return () => {
      if (timer) clearTimeout(timer);
      offMsg();
      offStatus();
    };
  }, []);

  // 把 SDK reminderManager 的本地 reminders 合并到 ConversationView.mentionCount
  // 注：useMemo 故意把 reminderTick 加进 deps —— reminders 是 SDK 可变数组，
  //     不进 React 视图，要靠 tick 触发重算（biome 看不到这层依赖，给 fixable warning，
  //     这里 disable 单行）
  // biome-ignore lint/correctness/useExhaustiveDependencies: reminderTick triggers recomputation of mutable SDK state
  const merged = useMemo(() => {
    if (!query.data) return query.data;
    const reminders = WKSDK.shared().reminderManager.reminders;
    if (!reminders || reminders.length === 0) return query.data;
    return applyReminderCounts(query.data, reminders);
  }, [query.data, reminderTick]);

  return { ...query, data: merged };
}
