import WKSDK, {
  Channel,
  type ChannelInfo as WKChannelInfo,
  ChannelInfo as WKChannelInfoCtor,
  type ConnectionInfo,
  ConnectStatus,
  type Message,
  type MessageContent as WKMessageContent,
  type SendackPacket,
} from "wukongimjssdk";
import { z } from "zod";
import { api } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { ChannelInfoSchema } from "@/api/schemas/channel";
import { ReminderListSchema, toReminder } from "@/api/schemas/reminder";
import { getModuleOrUnknown } from "@/messages/core/registry";
import { useAuthStore } from "@/stores/auth";
import { toSdkMessage } from "./messageConvert";
import { MediaMessageUploadTask } from "./uploadTask";

const RouteResponseSchema = z.object({
  wss_addr: z.string().optional(),
  ws_addr: z.string().optional(),
});

let setupDone = false;
let connectStarted = false;
let unsubAuth: (() => void) | null = null;
let onReceiveListener: ((m: Message) => void) | null = null;
let statusListener: ((s: ConnectStatus, code?: number) => void) | null = null;
let sendackListener: ((p: SendackPacket) => void) | null = null;
let cmdListener: ((m: Message) => void) | null = null;

/** 中央 onReceive 派发器：从 registry 找模块的 onReceive 钩子调用，错误隔离 */
function dispatchOnReceive(m: Message): void {
  const mod = getModuleOrUnknown(m.content.contentType);
  if (!mod.onReceive) return;
  try {
    mod.onReceive(m);
  } catch (err) {
    console.warn(`[octo:im] onReceive failed for type ${mod.type} (${mod.name})`, err);
  }
}

async function resolveAddrs(uid: string): Promise<string[]> {
  const data = await api.get(Endpoints.imRoute(uid)).json();
  const parsed = RouteResponseSchema.parse(data);
  const addr = parsed.wss_addr ?? parsed.ws_addr;
  return addr ? [addr] : [];
}

async function fetchChannelInfo(channel: Channel): Promise<WKChannelInfo> {
  const sdk = WKSDK.shared();
  let info = sdk.channelManager.getChannelInfo(channel);
  if (!info) {
    info = new WKChannelInfoCtor();
    info.channel = channel;
  }
  try {
    const data = await api
      .get(Endpoints.channelInfo(channel.channelID, channel.channelType))
      .json();
    const parsed = ChannelInfoSchema.safeParse(data);
    if (parsed.success) {
      const d = parsed.data;
      info.title = d.name ?? d.remark ?? channel.channelID;
      const logo = d.logo ?? d.avatar;
      if (logo) info.logo = logo;
      info.mute = (d.mute ?? 0) === 1;
      info.top = ((d.stick ?? d.top) ?? 0) === 1;
    }
  } catch (err) {
    console.debug("[octo:im] channelInfo not found", channel.channelID, channel.channelType, err);
    info.title = info.title || channel.channelID;
  }
  return info;
}

/* ---------------------------------------------------------------- *
 *  自己发的消息：SDK 立即推 stub（messageID=0/messageSeq=0）；
 *  SendackPacket 通过 messageStatusListener 回填，按 clientSeq 反查 stub。
 *  本进程内对外暴露 onImMessageUpdated fanout（替代原 messaging 广播）。
 * ---------------------------------------------------------------- */
export interface MessageUpdatedEvent {
  clientMsgNo: string;
  channelId: string;
  channelType: number;
  messageId: string;
  messageSeq: number;
  reasonCode: number;
}
const updatedSubs = new Set<(ev: MessageUpdatedEvent) => void>();
export function onImMessageUpdated(cb: (ev: MessageUpdatedEvent) => void): () => void {
  updatedSubs.add(cb);
  return () => {
    updatedSubs.delete(cb);
  };
}

export interface RevokeEvent {
  messageId: string;
  channelId: string;
  channelType: number;
  revoker: string;
}
const revokeSubs = new Set<(ev: RevokeEvent) => void>();
export function onImMessageRevoked(cb: (ev: RevokeEvent) => void): () => void {
  revokeSubs.add(cb);
  return () => {
    revokeSubs.delete(cb);
  };
}

const conversationsStaleSubs = new Set<() => void>();
export function onConversationsStale(cb: () => void): () => void {
  conversationsStaleSubs.add(cb);
  return () => {
    conversationsStaleSubs.delete(cb);
  };
}
function fireConversationsStale(): void {
  for (const s of conversationsStaleSubs) {
    try {
      s();
    } catch (err) {
      console.warn("[octo:im] conversationsStale subscriber threw", err);
    }
  }
}

const pendingByClientSeq = new Map<
  number,
  { clientMsgNo: string; channelId: string; channelType: number }
>();

/** 装配 SDK：地址回调 / 上传任务 / channelInfo / syncMessages / reminders + 中央监听器 */
export function setupIm(): void {
  if (setupDone) return;
  const sdk = WKSDK.shared();

  sdk.config.provider.connectAddrCallback = (cb) => {
    const auth = useAuthStore.getState().state;
    if (!auth?.loggedIn || !auth.token) {
      console.warn("[octo:im] connectAddrCallback skipped: not logged in");
      return;
    }
    void resolveAddrs(auth.uid)
      .then((addrs) => {
        console.info("[octo:im] resolveAddrs →", addrs);
        if (addrs[0]) cb(addrs[0]);
        else console.warn("[octo:im] no wss_addr in route response");
      })
      .catch((err) => {
        console.warn("[octo:im] resolve addr failed", err);
      });
  };

  sdk.config.provider.messageUploadTaskCallback = (m) => new MediaMessageUploadTask(m);

  sdk.config.provider.channelInfoCallback = (channel) => fetchChannelInfo(channel);

  sdk.config.provider.syncMessagesCallback = async (channel, opts) => {
    try {
      const resp = await api
        .post(Endpoints.messageChannelSync, {
          json: {
            channel_id: channel.channelID,
            channel_type: channel.channelType,
            start_message_seq: opts.startMessageSeq ?? 0,
            end_message_seq: opts.endMessageSeq ?? 0,
            limit: opts.limit ?? 30,
            pull_mode: opts.pullMode,
          },
        })
        .json<{ messages?: unknown[] }>();
      const list = Array.isArray(resp?.messages) ? resp.messages : [];
      return list.map((raw) => toSdkMessage(raw as Parameters<typeof toSdkMessage>[0]));
    } catch (err) {
      console.debug("[octo:im] syncMessages failed", err);
      return [];
    }
  };

  sdk.config.provider.syncRemindersCallback = async (version) => {
    try {
      const data = await api
        .post(Endpoints.messageReminderSync, {
          json: { version, limit: 100 },
        })
        .json();
      const raws = ReminderListSchema.parse(data ?? []);
      return raws.map(toReminder);
    } catch (err) {
      console.debug("[octo:im] syncReminders failed", err);
      return [];
    }
  };

  sdk.config.provider.reminderDoneCallback = async (ids) => {
    await api.post(Endpoints.messageReminderDone, { json: ids }).json();
  };

  // 中央 message listener：分发 onReceive + 记 clientSeq 等 sendack
  onReceiveListener = (m: Message) => {
    if (m.clientSeq && m.clientMsgNo) {
      pendingByClientSeq.set(m.clientSeq, {
        clientMsgNo: m.clientMsgNo,
        channelId: m.channel.channelID,
        channelType: m.channel.channelType,
      });
    }
    dispatchOnReceive(m);
    fireConversationsStale();
  };
  sdk.chatManager.addMessageListener(onReceiveListener);

  // sendack 回填：按 clientSeq 反查 → 通知本进程订阅者
  sendackListener = (sendack: SendackPacket) => {
    const pending = pendingByClientSeq.get(sendack.clientSeq);
    if (!pending) return;
    pendingByClientSeq.delete(sendack.clientSeq);
    const ev: MessageUpdatedEvent = {
      clientMsgNo: pending.clientMsgNo,
      channelId: pending.channelId,
      channelType: pending.channelType,
      messageId: sendack.messageID.toString(),
      messageSeq: sendack.messageSeq,
      reasonCode: sendack.reasonCode,
    };
    for (const cb of updatedSubs) {
      try {
        cb(ev);
      } catch (err) {
        console.warn("[octo:im] messageUpdated subscriber threw", err);
      }
    }
  };
  sdk.chatManager.addMessageStatusListener(sendackListener);

  // CMD listener：messageRevoke → onImMessageRevoked 订阅者
  cmdListener = (m: Message) => {
    const content = m.content as unknown as { cmd?: string; param?: Record<string, unknown> };
    if (!content || typeof content.cmd !== "string") return;
    if (content.cmd === "messageRevoke") {
      const param = content.param ?? {};
      const messageId = String(param.message_id ?? param.message_idstr ?? "");
      if (!messageId) return;
      const ev: RevokeEvent = {
        messageId,
        channelId: m.channel.channelID,
        channelType: m.channel.channelType,
        revoker: m.fromUID,
      };
      for (const cb of revokeSubs) {
        try {
          cb(ev);
        } catch (err) {
          console.warn("[octo:im] messageRevoked subscriber threw", err);
        }
      }
    }
  };
  sdk.chatManager.addCMDListener(cmdListener);

  // 连接状态变化时也告诉订阅者会话可能 stale（重连后会议列表要刷新）
  statusListener = (status) => {
    if (status === ConnectStatus.Connected) {
      fireConversationsStale();
    }
  };
  sdk.connectManager.addConnectStatusListener(statusListener);

  setupDone = true;
}

export interface ImBootOptions {
  /** 显式覆盖 token / uid，默认从 useAuthStore 读 */
  uid?: string;
  token?: string;
}

/** 启动连接（在 sidepanel / cmdk 入口调用） */
export function startIm(opts: ImBootOptions = {}): void {
  setupIm();
  const sdk = WKSDK.shared();
  const auth = useAuthStore.getState().state;
  const uid = opts.uid ?? auth?.uid;
  const token = opts.token ?? auth?.token;
  if (!uid || !token) {
    console.warn("[octo:im] startIm skipped: missing uid/token");
    return;
  }

  sdk.config.uid = uid;
  sdk.config.token = token;

  if (!connectStarted) {
    console.info("[octo:im] connectManager.connect()");
    sdk.connectManager.connect();
    connectStarted = true;
  }

  // 订阅 auth 变化：token 改变 → 重新连接
  unsubAuth?.();
  unsubAuth = useAuthStore.subscribe((s) => {
    const next = s.state;
    if (!next?.loggedIn || !next.token) {
      stopIm();
      return;
    }
    if (next.token !== sdk.config.token || next.uid !== sdk.config.uid) {
      sdk.config.uid = next.uid;
      sdk.config.token = next.token;
      sdk.connectManager.disconnect();
      sdk.connectManager.connect();
    }
  });
}

export function stopIm(): void {
  WKSDK.shared().connectManager.disconnect();
  connectStarted = false;
  unsubAuth?.();
  unsubAuth = null;
}

export function isImConnected(): boolean {
  return WKSDK.shared().connectManager.connected();
}

export function onImStatus(
  listener: (status: ConnectStatus, reasonCode?: number, info?: ConnectionInfo) => void,
): () => void {
  const sdk = WKSDK.shared();
  sdk.connectManager.addConnectStatusListener(listener);
  return () => {
    const arr = sdk.connectManager.connectStatusListeners;
    const idx = arr.indexOf(listener);
    if (idx >= 0) arr.splice(idx, 1);
  };
}

export function onImMessage(listener: (m: Message) => void): () => void {
  const sdk = WKSDK.shared();
  sdk.chatManager.addMessageListener(listener);
  return () => sdk.chatManager.removeMessageListener(listener);
}

export async function sendImMessage(
  content: WKMessageContent,
  channel: Channel,
): Promise<Message> {
  return WKSDK.shared().chatManager.send(content, channel);
}

/** reminder 同步：sidepanel 拿到一批 channelIds 后调；不传 channelIds 走全量 */
export async function syncReminders(): Promise<void> {
  try {
    await WKSDK.shared().reminderManager.sync();
    fireConversationsStale();
  } catch (err) {
    console.debug("[octo:im] syncReminders failed", err);
  }
}

export async function reminderDone(channel: Channel): Promise<void> {
  const waiting = WKSDK.shared().reminderManager.getWaitDoneReminders(channel);
  const ids = waiting.map((r) => r.reminderID);
  if (ids.length === 0) return;
  try {
    await WKSDK.shared().reminderManager.done(ids);
    for (const r of waiting) r.done = true;
    fireConversationsStale();
  } catch (err) {
    console.debug("[octo:im] reminderDone failed", err);
  }
}

export { Channel, ConnectStatus };
