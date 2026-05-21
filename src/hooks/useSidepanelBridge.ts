import { useEffect } from "react";
import { onMessage, sendMessage } from "@/platform/messaging";
import { pendingConversationStorage } from "@/platform/storage";
import { useCurrentChannel } from "@/stores/currentChannel";

const HEARTBEAT_INTERVAL = 3_000;

/**
 * Sidepanel 与 background 的桥接：
 * - 每 3 秒发心跳，让 background 知道 sidepanel 在前台 → 不弹系统通知
 * - 收 openConversation 消息 → 切到指定 channel
 * - 启动时读 pending-conversation（用户从通知/cmdk 触发的跳转）
 */
export function useSidepanelBridge(): void {
  const select = useCurrentChannel((s) => s.select);

  // 心跳
  useEffect(() => {
    const tick = () => {
      void sendMessage("sidepanelHeartbeat", undefined).catch(() => {});
    };
    tick();
    const t = setInterval(tick, HEARTBEAT_INTERVAL);
    return () => clearInterval(t);
  }, []);

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
