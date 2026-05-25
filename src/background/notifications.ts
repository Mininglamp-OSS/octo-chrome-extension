import { browser } from "wxt/browser";
import { onMessage, sendMessage } from "@/platform/messaging";
import { clearAllNotifications, notify } from "@/platform/notifications";
import { openSidePanel } from "@/platform/sidePanel";
import { authStorage, pendingConversationStorage, preferencesStorage } from "@/platform/storage";
import { setUnreadBadge } from "./badge";
import { closeOffscreenDocument, ensureOffscreenDocument } from "./offscreen";

/**
 * Background 端的通知 / badge 调度器。
 *
 * 信号源两路（互斥，不同时跑）：
 *  - offscreen（sidepanel 关时唯一信号源）—— deviceFlag=2，和 sidepanel 同槽位
 *  - sidepanel（前台时自持 SDK）—— 主动 sidepanelBadgeSync 推未读 + 心跳
 *
 * 互斥策略：sidepanel 与 offscreen 共用 deviceFlag=2，同时跑会被服务端互踢
 * （WuKongIM 服务端 (uid, device_flag, token) 三元组冲突）。于是：
 *   - sidepanel mount → sidepanelBadgeSync({active:true}) → background 关 offscreen
 *   - sidepanel unmount → active:false → background 启动 offscreen
 *   - heartbeat TTL 兜底：sidepanel 5s 无心跳视为关闭，自动拉起 offscreen
 *
 * 合并规则：
 *  - badge：sidepanel 活跃时用 sidepanel 数据，否则用 offscreen
 *  - 通知：sidepanel 活跃时不弹（避免和 sidepanel 内消息列表重复）
 */

const SIDEPANEL_ACTIVE_TTL_MS = 5_000;

let lastSidepanelActiveAt = 0;
let lastSidepanelHasUnread = false;
let lastOffscreenHasUnread = false;
let ttlCheckTimer: ReturnType<typeof setInterval> | null = null;

const notifMap = new Map<string, { channelId: string; channelType: number }>();

function sidepanelActive(): boolean {
  return Date.now() - lastSidepanelActiveAt < SIDEPANEL_ACTIVE_TTL_MS;
}

function recomputeBadge(): void {
  const hasUnread = sidepanelActive() ? lastSidepanelHasUnread : lastOffscreenHasUnread;
  void setUnreadBadge(hasUnread);
}

async function bringUpOffscreenIfLoggedIn(): Promise<void> {
  const auth = await authStorage.getValue();
  if (auth?.loggedIn) {
    await ensureOffscreenDocument();
  }
}

function startTtlCheck(): void {
  if (ttlCheckTimer) return;
  // 每 2s 检查：sidepanel TTL 过期 → 启 offscreen 接管；同时刷新 badge
  ttlCheckTimer = setInterval(() => {
    if (!sidepanelActive() && (lastSidepanelHasUnread || lastSidepanelActiveAt !== 0)) {
      // sidepanel 失活了，立即重启 offscreen + 刷新 badge
      lastSidepanelActiveAt = 0;
      lastSidepanelHasUnread = false;
      void bringUpOffscreenIfLoggedIn();
      recomputeBadge();
    }
  }, 2_000);
}

export function setupNotifications(): void {
  startTtlCheck();

  // ===== 来自 sidepanel =====
  onMessage("sidepanelHeartbeat", () => {
    lastSidepanelActiveAt = Date.now();
  });
  onMessage("sidepanelBadgeSync", ({ data }) => {
    const wasActive = sidepanelActive();
    if (data.active) {
      lastSidepanelActiveAt = Date.now();
      lastSidepanelHasUnread = data.hasUnread;
      // sidepanel 接管 → 关 offscreen 释放 ws 槽位（避免互踢）
      if (!wasActive) {
        console.info("[octo:bg] sidepanel took over, closing offscreen");
        void closeOffscreenDocument();
      }
    } else {
      // sidepanel 主动表态自己关闭：立即结束 sidepanel-active 窗口 + 拉起 offscreen
      lastSidepanelActiveAt = 0;
      lastSidepanelHasUnread = false;
      if (wasActive) {
        console.info("[octo:bg] sidepanel closed, bringing offscreen back");
        void bringUpOffscreenIfLoggedIn();
      }
    }
    recomputeBadge();
  });

  // ===== 来自 offscreen =====
  onMessage("offscreenSyncResult", ({ data }) => {
    lastOffscreenHasUnread = data.hasUnread;
    recomputeBadge();
  });

  onMessage("offscreenNewMessage", async ({ data }) => {
    const prefs = await preferencesStorage.getValue();
    if (!prefs.notificationsEnabled) return;
    // 偏好关掉桌面弹窗，但 badge 仍由 sync 路径处理
    if (!prefs.notificationsVisible) return;
    // sidepanel 在前台不弹，避免和消息列表内同步呈现重复
    if (sidepanelActive()) return;

    notifMap.set(data.notificationId, {
      channelId: data.channelId,
      channelType: data.channelType,
    });
    await notify({
      id: data.notificationId,
      title: data.title,
      message: data.body,
    });
  });

  onMessage("offscreenReady", () => {
    console.info("[octo:bg] offscreen ready, pushing auth");
    // offscreen 没有 storage 访问，启动时主动回送当前 auth 让它 connect
    void (async () => {
      const auth = await authStorage.getValue();
      if (auth?.loggedIn) {
        await sendMessage("authChanged", { auth }).catch(() => {});
      } else {
        await sendMessage("authCleared", undefined).catch(() => {});
      }
    })();
  });

  // ===== 通知点击交互 =====
  // 关键：onClicked 是 user-gesture context，必须**同步**调 sidePanel.open，
  // 不能绕 sendMessage → handler → openSidePanel（异步链丢手势）。
  // 链路对齐 mirror background.ts:351-372：写 pending → sp.open → 广播。
  browser.notifications.onClicked.addListener((id: string) => {
    const target = notifMap.get(id);
    notifMap.delete(id);
    if (!target) return;
    void browser.notifications.clear(id);

    // 1) 持久化 pending：sidepanel cold start 时启动后轮询消费（useSidepanelBridge）
    void pendingConversationStorage.setValue(target);
    // 2) 同步 fire sidePanel.open()，保住 user gesture
    void openSidePanel().catch(() => {});
    // 3) 已经热的 sidepanel 立即响应（无需等 storage round-trip）
    void sendMessage("openConversation", target).catch(() => {});
  });

  browser.notifications.onClosed.addListener((id: string) => {
    notifMap.delete(id);
  });

  // 偏好刷新（关掉总开关时立即清掉残留通知 + 红点）
  preferencesStorage.watch((prefs) => {
    if (!prefs.notificationsEnabled) {
      void clearAllNotifications();
      void setUnreadBadge(false);
    }
  });
}
