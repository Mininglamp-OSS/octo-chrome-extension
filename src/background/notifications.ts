import type { MessageView } from "@/im/message";
import { getModuleOrUnknown } from "@/messages/core/registry";
import { onMessage, sendMessage } from "@/platform/messaging";
import { clearAllNotifications, clearNotification, notify } from "@/platform/notifications";
import { preferencesStorage } from "@/platform/storage";
import { setUnreadBadge } from "./badge";

const ACTIVE_TTL_MS = 5_000;
let lastSidepanelActiveAt = 0;
const notifMap = new Map<string, { channelId: string; channelType: number }>();

function sidepanelIsActive(): boolean {
  return Date.now() - lastSidepanelActiveAt < ACTIVE_TTL_MS;
}

function digestOf(m: MessageView): string {
  const mod = getModuleOrUnknown(m.content.type);
  try {
    return mod.digest(m.content.data) || "[消息]";
  } catch {
    return "[消息]";
  }
}

function shouldNotify(m: MessageView): boolean {
  const mod = getModuleOrUnknown(m.content.type);
  return mod.notifiable !== false;
}

export function setupNotifications(): void {
  // 监听 sidepanel 心跳，活跃时不弹通知
  onMessage("sidepanelHeartbeat", () => {
    lastSidepanelActiveAt = Date.now();
  });

  // offscreen 推新消息 → 决定是否弹通知 + 更新角标
  onMessage("imMessageReceived", async ({ data }) => {
    const m = data.message;
    void setUnreadBadge(true);

    const prefs = await preferencesStorage.getValue();
    if (!prefs.notificationsEnabled || !prefs.notificationsVisible) return;
    if (sidepanelIsActive()) return;
    if (!shouldNotify(m)) return;

    const id = `octo-msg-${m.channelType}-${m.channelId}-${m.messageId}`;
    notifMap.set(id, { channelId: m.channelId, channelType: m.channelType });
    await notify({ id, title: m.fromUid || "新消息", message: digestOf(m) });
  });

  // 用户点击系统通知 → 打开 sidepanel + 跳转会话
  browser.notifications.onClicked.addListener((id: string) => {
    const target = notifMap.get(id);
    notifMap.delete(id);
    if (!target) return;
    void browser.notifications.clear(id);
    void sendMessage("requestOpenSidePanel", {}).catch(() => {});
    void sendMessage("openConversation", target).catch(() => {});
  });

  browser.notifications.onClosed.addListener((id: string) => {
    notifMap.delete(id);
  });
}

export { clearAllNotifications, clearNotification };
