import type { Message } from "wukongimjssdk";
import WKSDK, { Channel } from "wukongimjssdk";
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
import { ImNotConnectedError } from "@/im/sendError";
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
  // 入口快速失败：ws 未连接时直接 reject，避免 SDK fire-and-forget 静默吞包后
  // 让用户等 10s 才看到红 ❌。可见性提示由调用方（Composer）的 catch toast 负责。
  if (!isImConnected()) {
    // 报「IM 未连接」时把当时 SDK 的真实连接态打出来，区分：
    //  - 从未连上（status 一直 Disconnect/Connecting）
    //  - 连上后掉线（之前 connectStatus 日志里有过 Connected）
    //  - cmdk/sidepanel 持的是哪份实例没 startIm
    const sdk = WKSDK.shared();
    console.warn("[octo:im] imSendMessage rejected: not connected", {
      sdkStatus: sdk.connectManager.status,
      statusName: ConnectStatus[sdk.connectManager.status] ?? String(sdk.connectManager.status),
      connected: sdk.connectManager.connected(),
      hasUid: !!sdk.config.uid,
      hasToken: !!sdk.config.token,
      channelId: req.channelId,
      channelType: req.channelType,
    });
    throw new ImNotConnectedError();
  }
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
