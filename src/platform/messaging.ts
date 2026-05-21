import { defineExtensionMessaging } from "@webext-core/messaging";
import type { MessageView } from "@/im/message";
import type { SerializedContent } from "@/messages/core/registry";
import type { AuthState, PendingConversation } from "./storage";

export type { SerializedContent };

/** 发送消息参数（cmdk → sidepanel-side helper 用，运行时已不跨 context） */
export interface SendMessageReq {
  channelId: string;
  channelType: number;
  content: SerializedContent;
}

/** 系统通知 → 跳到指定会话 */
export interface OpenConversationPayload {
  channelId: string;
  channelType: number;
  source?: string;
}

export interface OpenCmdkPayload {
  selectedText?: string;
  pageUrl?: string;
  pageTitle?: string;
  hostname?: string;
}

/**
 * 跨 context 协议（background ↔ sidepanel ↔ cmdk ↔ content scripts）。
 *
 * 设计：
 * - SDK 直接跑在 sidepanel / cmdk 各自进程里（mirror extension 模式）
 * - IM 推送主要在本进程消费，**只有"system notification + badge"** 需要 sidepanel 主动
 *   forward 到 background —— 否则 service worker 看不到消息流，弹不了通知
 */
export interface OctoProtocolMap {
  /* ===== 鉴权同步 ===== */
  authChanged(payload: { auth: AuthState }): void;
  authCleared(): void;
  getAuthState(): { auth: AuthState | null };

  /* ===== Notification 桥：sidepanel SDK → background notifications/badge ===== */
  imMessageReceived(payload: { message: MessageView }): void;

  /* ===== Sidepanel / Cmdk 跳转 ===== */
  openConversation(payload: OpenConversationPayload): void;
  requestOpenSidePanel(payload?: { windowId?: number }): void;
  requestOpenConversation(payload: PendingConversation): void;
  sidepanelBadgeSync(payload: { hasUnread: boolean }): void;
  sidepanelHeartbeat(): void;

  /* ===== Cmdk 浮层 ===== */
  openCmdk(payload: OpenCmdkPayload): void;

  /* ===== QQ 文档桥 ===== */
  qqDocSelectionChanged(payload: { text: string; pageTitle: string; pageUrl: string }): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<OctoProtocolMap>();
