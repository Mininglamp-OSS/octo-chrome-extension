import { useEffect, useMemo } from "react";
import { useConversations } from "@/api/queries/conversations";
import type { ConversationView } from "@/im/conversation";
import { onMessage, sendMessage } from "@/platform/messaging";
import { pendingConversationStorage } from "@/platform/storage";
import { useCurrentChannel } from "@/stores/currentChannel";

const HEARTBEAT_INTERVAL_MS = 2_000;

function computeHasUnread(
  convs: ConversationView[],
  excludeId: string | null,
  excludeType: number,
): boolean {
  for (const c of convs) {
    // 当前正在看的 channel 视为已读 —— 后端 clearUnread 接口下次 conversation/sync
    // 返回 unread 字段未必立刻归 0（可能依赖 browseToMessageSeq diff，需要新消息触发），
    // 但从用户视角"正在看的就是已读"，icon 红点要立刻跟随这个直觉。
    if (excludeId && c.channelId === excludeId && c.channelType === excludeType) continue;
    if ((c.unread ?? 0) > 0) return true;
  }
  return false;
}

/**
 * Sidepanel 与 background 的桥接：
 * - 收 openConversation 消息 → 切到指定 channel
 * - 启动时读 pending-conversation（用户从 cmdk 触发的跳转）
 * - mount 时持续发 sidepanelHeartbeat（让 background 暂停 offscreen 弹窗，避免重复）
 * - 未读总览变化时 sidepanelBadgeSync → 让 icon 红点跟随 sidepanel 视图（前台优先源）
 */
export function useSidepanelBridge(): void {
  const select = useCurrentChannel((s) => s.select);
  const currentId = useCurrentChannel((s) => s.channelId);
  const currentType = useCurrentChannel((s) => s.channelType);
  const { data: conversations } = useConversations();

  const hasUnread = useMemo(
    () => computeHasUnread(conversations ?? [], currentId, currentType),
    [conversations, currentId, currentType],
  );

  // 监听跳转
  useEffect(() => {
    const off = onMessage("openConversation", ({ data }) => {
      select(data.channelId, data.channelType);
    });
    return off;
  }, [select]);

  // 启动消费 pending —— 30s 内每 1s 轮询，解决 background 写 storage 与
  // sidepanel cold start 读 storage 的竞态（mirror sidepanel/main.tsx:75-115 同款）。
  // 已经热的 sidepanel 走 openConversation 广播分支立即响应，这里只是兜底。
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const deadline = Date.now() + 30_000;
    const tryConsume = async (): Promise<boolean> => {
      if (cancelled) return true;
      const pending = await pendingConversationStorage.getValue();
      if (!pending) return false;
      select(pending.channelId, pending.channelType);
      await pendingConversationStorage.setValue(null);
      return true;
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    void tryConsume().then((done) => {
      if (done || cancelled) return;
      timer = setInterval(() => {
        if (cancelled || Date.now() > deadline) {
          stop();
          return;
        }
        void tryConsume().then((d) => {
          if (d) stop();
        });
      }, 1_000);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [select]);

  // 心跳：mount 即开始，unmount 推 active=false 立刻结束 sidepanel-active 窗口
  useEffect(() => {
    void sendMessage("sidepanelBadgeSync", { active: true, hasUnread: false }).catch(() => {});
    const tick = setInterval(() => {
      void sendMessage("sidepanelHeartbeat", undefined).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      void sendMessage("sidepanelBadgeSync", { active: false, hasUnread: false }).catch(() => {});
    };
  }, []);

  // 未读变化时单独推 badge sync（不重启 interval）
  useEffect(() => {
    void sendMessage("sidepanelBadgeSync", { active: true, hasUnread }).catch(() => {});
  }, [hasUnread]);
}
