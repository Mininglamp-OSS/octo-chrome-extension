import { browser } from "wxt/browser";
import { isActiveImSlotClaim } from "@/im/slot";
import { onMessage, sendMessage } from "@/platform/messaging";
import { clearAllNotifications, notify } from "@/platform/notifications";
import { openSidePanel } from "@/platform/sidePanel";
import {
  authStorage,
  imSlotClaimStorage,
  pendingConversationStorage,
  preferencesStorage,
} from "@/platform/storage";
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
/** 过期 cmdk slot claim 的 durable 清理 alarm 名 */
const IM_SLOT_CLEANUP_ALARM = "im-slot-cleanup";

let lastSidepanelActiveAt = 0;
let lastSidepanelHasUnread = false;
let lastOffscreenHasUnread = false;
let ttlCheckTimer: ReturnType<typeof setInterval> | null = null;
// 角标总开关缓存：关闭时所有 hasUnread 信号都被吞掉（避免 sidepanel 开启时再次点亮红点）
let badgeEnabled = true;

const notifMap = new Map<string, { channelId: string; channelType: number }>();

function sidepanelActive(): boolean {
  return Date.now() - lastSidepanelActiveAt < SIDEPANEL_ACTIVE_TTL_MS;
}

function recomputeBadge(): void {
  if (!badgeEnabled) {
    void setUnreadBadge(false);
    return;
  }
  const hasUnread = sidepanelActive() ? lastSidepanelHasUnread : lastOffscreenHasUnread;
  void setUnreadBadge(hasUnread);
}

async function bringUpOffscreenIfLoggedIn(): Promise<void> {
  if (sidepanelActive()) return;
  if (isActiveImSlotClaim(await imSlotClaimStorage.getValue())) return;
  const auth = await authStorage.getValue();
  if (auth?.loggedIn) {
    await ensureOffscreenDocument();
  }
}

/**
 * sidepanel 失活的统一处理：立即结束 active 窗口 + 拉起 offscreen + 刷红点。
 * 三个来源都汇到这里（去重）：
 *  - sidepanel unmount 主动 sendMessage(active:false) —— 但 page 卸载时 IPC 可能丢
 *  - chrome.sidePanel.onClosed (Chrome 142+) —— background 端主动感知，最可靠
 *  - TTL 兜底（5s 无心跳）—— sidepanel 进程异常死亡的最后防线
 */
function handleSidepanelInactive(reason: string): void {
  if (lastSidepanelActiveAt === 0 && !lastSidepanelHasUnread) return;
  console.info(`[octo:bg] sidepanel inactive (${reason}), bringing offscreen back`);
  lastSidepanelActiveAt = 0;
  lastSidepanelHasUnread = false;
  void bringUpOffscreenIfLoggedIn();
  recomputeBadge();
}

function startTtlCheck(): void {
  if (ttlCheckTimer) return;
  // 每 2s 检查：sidepanel 心跳 5s 过期 → 视为失活，走兜底
  ttlCheckTimer = setInterval(() => {
    if (!sidepanelActive() && lastSidepanelActiveAt !== 0) {
      handleSidepanelInactive("ttl");
    }
  }, 2_000);
}

function setupImSlotClaimWatch(): void {
  imSlotClaimStorage.watch((claim) => {
    if (isActiveImSlotClaim(claim)) {
      void closeOffscreenDocument();
      return;
    }
    void bringUpOffscreenIfLoggedIn();
  });

  // claim 过期自愈：cmdk 非正常退出（崩溃/强杀/浏览器关闭）时 releaseImSlot IPC
  // 不会发、unmount cleanup 也不跑 → claim 残留在 storage。它逻辑上过期后，
  // storage 本身不再变化，watch 永不重触发 → offscreen/sidepanel 会被永久 block。
  //
  // 必须用 chrome.alarms 而非 setInterval：MV3 service worker ~30s idle 即被杀，
  // setInterval 随之失效、不再续命（badge.ts 同款认知）；alarms 是 MV3 下唯一能
  // 在 SW 休眠后仍按时唤醒 SW 的 durable 定时器。alarm 触发时清掉过期 claim →
  // 写 null → 上面 watch 重跑 → bringUpOffscreenIfLoggedIn 恢复后台连接。
  // periodInMinutes 用 1（不是 0.5）：Chrome 生产环境对 alarms 最小周期钳到 1 分钟，
  // 写 0.5 在 dev 下能跑、生产会被静默钳到 1，代码意图与实际不符。这里只是过期 claim
  // 的 durable 兜底（前台 expiryTimer 已覆盖 sidepanel 开着的常见场景），1 分钟可接受。
  browser.alarms.create(IM_SLOT_CLEANUP_ALARM, { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== IM_SLOT_CLEANUP_ALARM) return;
    void imSlotClaimStorage.getValue().then(async (claim) => {
      if (!claim || isActiveImSlotClaim(claim)) return;
      await imSlotClaimStorage.setValue(null);
    });
  });
}

export function setupNotifications(): void {
  startTtlCheck();
  setupImSlotClaimWatch();

  // 初始化 + 监听角标总开关
  void preferencesStorage.getValue().then((prefs) => {
    badgeEnabled = prefs.notificationsEnabled;
    recomputeBadge();
  });

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
      recomputeBadge();
    } else {
      // sidepanel 主动表态自己关闭（IPC 可能丢，onClosed 是更可靠的兜底）
      handleSidepanelInactive("unmount-ipc");
    }
  });

  // Chrome 142+ chrome.sidePanel.onClosed：sidepanel page 关闭时 background 主动得知。
  // 比 sidepanel unmount sendMessage 更可靠（page 卸载时 IPC 可能丢，导致 offscreen
  // 不及时拉起、桌面通知漏弹）。对齐 mirror background.ts:605-608。
  const sidePanelApi = (chrome as unknown as { sidePanel?: { onClosed?: chrome.events.Event<() => void> } }).sidePanel;
  if (sidePanelApi?.onClosed) {
    sidePanelApi.onClosed.addListener(() => {
      handleSidepanelInactive("sidePanel.onClosed");
    });
  }

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

  // 偏好刷新：同步 badgeEnabled 缓存；关掉时清掉残留通知 + recompute 把红点也归零
  preferencesStorage.watch((prefs) => {
    badgeEnabled = prefs.notificationsEnabled;
    if (!prefs.notificationsEnabled) {
      void clearAllNotifications();
    }
    recomputeBadge();
  });
}
