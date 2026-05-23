import { useEffect } from "react";
import { onMessage } from "@/platform/messaging";
import { pendingConversationStorage } from "@/platform/storage";
import { useCurrentChannel } from "@/stores/currentChannel";

/**
 * Sidepanel 与 background 的桥接：
 * - 收 openConversation 消息 → 切到指定 channel
 * - 启动时读 pending-conversation（用户从 cmdk 触发的跳转）
 */
export function useSidepanelBridge(): void {
  const select = useCurrentChannel((s) => s.select);

  // 监听跳转
  useEffect(() => {
    const off = onMessage("openConversation", ({ data }) => {
      select(data.channelId, data.channelType);
    });
    return off;
  }, [select]);

  // 启动时消费 pending
  useEffect(() => {
    let cancelled = false;
    void pendingConversationStorage.getValue().then(async (pending) => {
      if (cancelled || !pending) return;
      select(pending.channelId, pending.channelType);
      await pendingConversationStorage.setValue(null);
    });
    return () => {
      cancelled = true;
    };
  }, [select]);
}
