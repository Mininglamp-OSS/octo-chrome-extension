import WKSDK, {
  Channel,
  type Message,
  type ChannelInfo as WKChannelInfo,
  ChannelInfo as WKChannelInfoCtor,
} from "wukongimjssdk";
import { z } from "zod";
import { api } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { ChannelType } from "@/const/channel";
import { getModuleOrUnknown } from "@/messages/core/registry";
import { onMessage, sendMessage } from "@/platform/messaging";
import type { AuthState } from "@/platform/storage";
import { useAuthStore } from "@/stores/auth";

/**
 * Offscreen 进程：sidepanel 关闭时仍维持一份 IM 长连接，
 * 让 background 能更新 icon 红点并弹系统通知。
 *
 * 与 sidepanel 内的 src/im/client.ts 不共享代码：
 *  - 这里只做 connect + 监听新消息 + 推 hasUnread，不需要业务事件总线
 *  - deviceFlag = 2 (pc)，必须和 sidepanel + OIDC 登录 flag 一致（见下方 sdk.config 注释）
 *  - sidepanel 与 offscreen 同 (uid, deviceFlag, token) 必互踢，靠 background 互斥调度：
 *    sidepanel 打开 → 关 offscreen；sidepanel 关 → 拉起 offscreen
 *  - api/client.ts 的 token header 从 useAuthStore 读，所以 offscreen 必须先把
 *    auth 灌进 zustand store（vanilla store 在非 React 环境也能跑）
 *
 * Auth 来源：**完全通过 messaging 由 background 推送**。
 *  - chrome.storage / wxt/storage / browser.storage 在 offscreen context 实测都是 undefined
 *    （browser polyfill 不注入；chrome 全局上没挂 storage），所以不能自己读
 *  - 启动顺序：先注册 onMessage handlers → 再 sendMessage("offscreenReady") →
 *    background 收到后回送 authChanged，offscreen 拿到才 connect
 */

const SYNC_DEBOUNCE_MS = 300;

const RouteSchema = z.object({
  wss_addr: z.string().optional(),
  ws_addr: z.string().optional(),
});

const ChannelStateSchema = z.object({
  name: z.string().optional(),
  remark: z.string().optional(),
  logo: z.string().optional(),
  avatar: z.string().optional(),
  mute: z.number().optional(),
  stick: z.number().optional(),
  top: z.number().optional(),
});

const sdk = WKSDK.shared();
// deviceFlag 必须和 sidepanel (src/im/client.ts) 一致 = 2 (pc)：
// WuKongIM 服务端把 (uid, device_flag, token) 作为查找键，OIDC 登录时
// flag 决定了 token 的 deviceFlag。SDK 用不同 flag connect 会查不到 token
// 而被服务端静默 close（1006 / 无 CONNACK）。
//
// 这意味着 sidepanel 和 offscreen **同 flag → 必然互踢**。靠互斥规避：
// sidepanel 打开时 background 关 offscreen，sidepanel 关闭时再启动 offscreen。
sdk.config.deviceFlag = 2;

let connectStarted = false;
let lastHasUnread = false;
let syncTimer: number | null = null;
let currentUid = "";
let currentToken = "";

async function fetchAddrs(uid: string): Promise<string | null> {
  try {
    const data = await api.get(Endpoints.imRoute(uid)).json();
    const parsed = RouteSchema.parse(data);
    return parsed.wss_addr ?? parsed.ws_addr ?? null;
  } catch (err) {
    console.warn("[octo:offscreen] fetchAddrs failed", err);
    return null;
  }
}

async function fetchChannelInfo(channel: Channel): Promise<WKChannelInfo> {
  const info = sdk.channelManager.getChannelInfo(channel) ?? new WKChannelInfoCtor();
  info.channel = channel;
  try {
    const data = await api
      .get(Endpoints.channelInfo(channel.channelID, channel.channelType))
      .json();
    const parsed = ChannelStateSchema.safeParse(data);
    if (parsed.success) {
      const d = parsed.data;
      // remark 优先于 name，对齐 sidepanel resolveDisplayName（VerticalRail.tsx）
      info.title = d.remark?.trim() || d.name?.trim() || channel.channelID;
      const logo = d.logo ?? d.avatar;
      if (logo) info.logo = logo;
      info.mute = (d.mute ?? 0) === 1;
      info.top = (d.stick ?? d.top ?? 0) === 1;
    } else {
      info.title = info.title || channel.channelID;
    }
  } catch {
    info.title = info.title || channel.channelID;
  }
  return info;
}

function setupProviders(): void {
  sdk.config.provider.connectAddrCallback = (cb) => {
    if (!currentUid || !currentToken) {
      console.warn("[octo:offscreen] connectAddrCallback skipped: no auth");
      return;
    }
    void fetchAddrs(currentUid).then((addr) => {
      if (addr) cb(addr);
      else console.warn("[octo:offscreen] no wss_addr in route response");
    });
  };
  sdk.config.provider.channelInfoCallback = (channel) => fetchChannelInfo(channel);
}

function computeHasUnread(): boolean {
  for (const conv of sdk.conversationManager.conversations) {
    if ((conv.unread ?? 0) <= 0) continue;
    const info = sdk.channelManager.getChannelInfo(conv.channel);
    if (info?.mute) continue;
    return true;
  }
  return false;
}

function scheduleSync(): void {
  if (syncTimer != null) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const hasUnread = computeHasUnread();
    if (hasUnread === lastHasUnread) return;
    lastHasUnread = hasUnread;
    void sendMessage("offscreenSyncResult", { hasUnread }).catch(() => {});
  }, SYNC_DEBOUNCE_MS) as unknown as number;
}

/** 解析 channel 标题：先看 SDK 缓存，没有就去拉 channelInfo（对齐 mirror resolveNotificationTitle） */
async function resolveChannelTitle(channel: Channel): Promise<string> {
  const cached = sdk.channelManager.getChannelInfo(channel);
  const cachedTitle = cached?.title?.trim();
  if (cachedTitle) return cachedTitle;
  try {
    const info = await fetchChannelInfo(channel);
    return info.title?.trim() || channel.channelID;
  } catch {
    return channel.channelID;
  }
}

/** 群消息发送者 displayName：把 fromUID 当 person channel 查（对齐 mirror resolveSenderName） */
async function resolveSenderName(fromUID: string): Promise<string> {
  if (!fromUID) return "";
  const ch = new Channel(fromUID, ChannelType.person);
  const cached = sdk.channelManager.getChannelInfo(ch);
  const cachedName = cached?.title?.trim();
  if (cachedName) return cachedName;
  try {
    const info = await fetchChannelInfo(ch);
    return info.title?.trim() || fromUID;
  } catch {
    return fromUID;
  }
}

async function buildNotificationPayload(m: Message): Promise<{
  notificationId: string;
  title: string;
  body: string;
  channelId: string;
  channelType: number;
} | null> {
  if (currentUid && m.fromUID === currentUid) return null;

  const mod = getModuleOrUnknown(m.contentType);
  if (mod.notifiable === false) return null;

  // mute 检查：先用缓存，没缓存就拉一次（拉到后顺便 cache title）
  let info = sdk.channelManager.getChannelInfo(m.channel);
  if (!info) {
    try {
      info = await fetchChannelInfo(m.channel);
    } catch {
      info = undefined;
    }
  }
  if (info?.mute) return null;

  let body: string;
  try {
    const ui = mod.toUI(m.content as never);
    body = mod.digest(ui as never) || "[消息]";
  } catch {
    body = "[消息]";
  }

  if (m.channel.channelType === ChannelType.group) {
    const senderName = await resolveSenderName(m.fromUID);
    if (senderName) body = `${senderName}：${body}`;
  }

  const title = (info?.title?.trim() || (await resolveChannelTitle(m.channel))) ?? "新消息";
  const notificationId = `octo-msg-${m.channel.channelType}-${m.channel.channelID}-${m.messageID}`;
  return {
    notificationId,
    title,
    body,
    channelId: m.channel.channelID,
    channelType: m.channel.channelType,
  };
}

/**
 * 检测一条消息是否在 @ 当前用户（与 sidepanel 的 useAtMeWatcher 同公式）：
 * 模块声明 mentionable + 消息 data.mentionUids 含 currentUid。
 */
function isMentioningMe(m: Message): boolean {
  if (!currentUid || m.fromUID === currentUid) return false;
  const mod = getModuleOrUnknown(m.contentType);
  if (!mod.mentionable) return false;
  try {
    const ui = mod.toUI(m.content as never) as { mentionUids?: string[] };
    return !!ui.mentionUids?.includes(currentUid);
  } catch {
    return false;
  }
}

function setupListeners(): void {
  sdk.chatManager.addMessageListener((m: Message) => {
    void buildNotificationPayload(m).then((payload) => {
      if (payload) {
        void sendMessage("offscreenNewMessage", payload).catch(() => {});
      }
    });
    if (isMentioningMe(m)) {
      void sendMessage("atMeBump", {
        channelId: m.channel.channelID,
        channelType: m.channel.channelType,
      }).catch(() => {});
    }
    scheduleSync();
  });

  sdk.conversationManager.addConversationListener(() => {
    scheduleSync();
  });

  sdk.connectManager.addConnectStatusListener((status) => {
    console.info("[octo:offscreen] connect status", status);
  });
}

function applyAuth(auth: AuthState | null): void {
  // 把 auth 灌到 zustand store，api/client.ts 的 beforeRequest hook 才能拿到 token
  if (auth?.loggedIn && auth.token && auth.uid) {
    useAuthStore.setState({ state: auth });
  } else {
    useAuthStore.setState({ state: null });
  }

  if (!auth?.loggedIn || !auth.token || !auth.uid) {
    if (connectStarted) {
      sdk.connectManager.disconnect();
      connectStarted = false;
    }
    if (lastHasUnread) {
      lastHasUnread = false;
      void sendMessage("offscreenSyncResult", { hasUnread: false }).catch(() => {});
    }
    currentUid = "";
    currentToken = "";
    return;
  }

  const tokenChanged = currentToken !== auth.token || currentUid !== auth.uid;
  currentUid = auth.uid;
  currentToken = auth.token;
  sdk.config.uid = auth.uid;
  sdk.config.token = auth.token;

  if (!connectStarted) {
    console.info("[octo:offscreen] connect()", { uid: auth.uid, deviceFlag: 2 });
    sdk.connectManager.connect();
    connectStarted = true;
    return;
  }

  if (tokenChanged) {
    console.info("[octo:offscreen] reconnect (token/uid changed)");
    sdk.connectManager.disconnect();
    sdk.connectManager.connect();
  }
}

async function readAuthFromStorage(): Promise<AuthState | null> {
  // offscreen 无 storage API，永远返回 null —— 真正的 auth 由 background 通过
  // messaging 推送（见 onMessage("authChanged") 注册）。保留函数是为了 bootstrap
  // 流程结构一致。
  return null;
}

function bootstrap(): void {
  setupProviders();
  setupListeners();

  // 先注册 onMessage，再发 offscreenReady，避免 background 立即回信但 offscreen
  // 还没监听导致丢消息
  onMessage("authChanged", ({ data }) => applyAuth(data.auth));
  onMessage("authCleared", () => applyAuth(null));

  void readAuthFromStorage().then((auth) => applyAuth(auth));

  // 通知 background offscreen 就绪 —— background 收到后会回 authChanged
  void sendMessage("offscreenReady").catch(() => {});
}

bootstrap();
