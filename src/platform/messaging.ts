import { defineExtensionMessaging } from "@webext-core/messaging";
import type { SerializedContent } from "@/messages/core/registry";
import type { AuthState, PendingConversation } from "./storage";

export type { SerializedContent };

/** 发送消息参数（cmdk → sidepanel-side helper 用，运行时已不跨 context） */
export interface SendMessageReq {
  channelId: string;
  channelType: number;
  content: SerializedContent;
}

/** cmdk / SSO 跳转 → 切到指定会话 */
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
 * - IM 推送在本进程消费即可，background 不再参与消息流
 */
export interface OctoProtocolMap {
  /* ===== 鉴权同步 ===== */
  authChanged(payload: { auth: AuthState }): void;
  authCleared(): void;
  getAuthState(): { auth: AuthState | null };

  /* ===== SSO ===== */
  startSsoPolling(payload: { authcode: string; windowId: number }): void;

  /* ===== Sidepanel / Cmdk 跳转 ===== */
  openConversation(payload: OpenConversationPayload): void;
  requestOpenSidePanel(payload?: { windowId?: number }): void;
  requestOpenConversation(payload: PendingConversation): void;

  /* ===== Cmdk 浮层 ===== */
  openCmdk(payload: OpenCmdkPayload): void;

  /* ===== QQ 文档桥 ===== */
  qqDocSelectionChanged(payload: { text: string; pageTitle: string; pageUrl: string }): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<OctoProtocolMap>();
