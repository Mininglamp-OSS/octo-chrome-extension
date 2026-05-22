import type { Message } from "wukongimjssdk";
import { Channel } from "wukongimjssdk";
import {
  ConnectStatus,
  isImConnected,
  onConversationsStale,
  onImMessageRevoked,
  onImMessageUpdated,
  onImStatus,
  onImMessage as onSdkMessage,
  reminderDone as sdkReminderDone,
  syncReminders as sdkSyncReminders,
  sendImMessage,
} from "@/im/client";
import { type MessageView, toMessageView } from "@/im/message";
import { rehydrateContent } from "@/im/serialize";
import type { SendMessageReq } from "@/platform/messaging";

/**
 * sidepanel / cmdk 用的 IM 包装层。
 *
 * 重构前：所有 RPC 经 offscreen。
 * 现在：SDK 直接跑在当前进程（sidepanel / cmdk 各持一份），本文件只做：
 *   1. 把 SDK Message 投影成可序列化的 MessageView，给 React Query / UI 消费
 *   2. 提供跟旧 API 一致的 onImMessage(view) 形状，避免大改 caller
 *   3. sendMessage 包装：把 SerializedContent 还原成 SDK content 再发
 *
 * 不再涉及 @webext-core/messaging，所有事件都同进程订阅。
 */

export async function imGetStatus(): Promise<number> {
  return isImConnected() ? ConnectStatus.Connected : ConnectStatus.Disconnect;
}

export async function imSendMessage(req: SendMessageReq): Promise<string> {
  // 不做 isImConnected 前置检查（与 octo-web/mirror 行为一致：直接 chatManager.send）。
  // SDK 内部是 fire-and-forget：未连接时 WKWebsocket.send 会静默 return，sendack 永远不回。
  // 失败可见性靠 useChannelMessages 的 stub 10s 超时降级（标 sendFailed=true）+ MessageBubble
  // 的红色 AlertCircle 视觉态，而不是阻塞用户发送。
  const content = rehydrateContent(req.content);
  const channel = new Channel(req.channelId, req.channelType);
  const msg = await sendImMessage(content, channel);
  return msg.messageID;
}

export async function imSyncReminders(): Promise<void> {
  await sdkSyncReminders();
}

export async function imReminderDone(channelId: string, channelType: number): Promise<void> {
  await sdkReminderDone(new Channel(channelId, channelType));
}

/** 订阅"收到任意消息"——投影成 MessageView 给消费方，保持原 API 形状 */
export function onImMessage(cb: (view: MessageView) => void): () => void {
  const handler = (m: Message) => {
    try {
      cb(toMessageView(m));
    } catch (err) {
      console.warn("[octo:im] onImMessage view consumer threw", err);
    }
  };
  return onSdkMessage(handler);
}

export { ConnectStatus, onConversationsStale, onImMessageRevoked, onImMessageUpdated, onImStatus };
