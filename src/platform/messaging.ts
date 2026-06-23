import { defineExtensionMessaging } from "@webext-core/messaging";
import type { ImSlotClaim } from "@/im/slot";
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
 * 跨 context 协议（background ↔ sidepanel ↔ cmdk ↔ content scripts ↔ offscreen）。
 *
 * 设计：
 * - SDK 直接跑在 sidepanel / cmdk 各自进程里（mirror extension 模式）
 * - **另一份精简 SDK 跑在 offscreen document 里**，sidepanel 关时仍维持长连接，
 *   推 `offscreenSyncResult` / `offscreenNewMessage` 给 background 渲染 icon 红点和系统通知
 * - sidepanel 在前台时通过 `sidepanelHeartbeat` + `sidepanelBadgeSync` 让 background 暂停弹窗、合并 badge
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

  /* ===== Offscreen ↔ Background ===== */
  /** offscreen 进程加载完成；background 收到后回送当前 auth 触发 connect */
  offscreenReady(): void;
  /** offscreen 计算的会话集 hasUnread（仅 boolean，跟 mirror 一致不精确未读数） */
  offscreenSyncResult(payload: { hasUnread: boolean }): void;
  /** offscreen 收到一条本应通知的新消息 */
  offscreenNewMessage(payload: {
    notificationId: string;
    title: string;
    body: string;
    channelId: string;
    channelType: number;
  }): void;
  /**
   * 通用 @我 bump —— offscreen 或 sidepanel 检测到 mention 自己时调用，
   * background 把计数累加到 atMeCountsStorage，供下次 sidepanel hydrate
   */
  atMeBump(payload: { channelId: string; channelType: number }): void;
  /** sidepanel 进入会话时清掉该会话的 @ 计数（同时清 storage） */
  atMeClear(payload: { channelId: string; channelType: number }): void;

  /* ===== Sidepanel → Background 协同 ===== */
  /** sidepanel 周期性心跳，5s TTL 内 background 暂停 offscreen 弹窗避免重复 */
  sidepanelHeartbeat(): void;
  /** sidepanel 主动告知自身活跃状态 + 当前未读，背景以最新 active 源为准 */
  sidepanelBadgeSync(payload: { active: boolean; hasUnread: boolean }): void;

  /** 临时独占 deviceFlag=2 的 IM 槽位（cmdk 短发期间用）。
   *  返回是否抢到：已有他人 active claim 时拒绝（单 owner 仲裁，防多 cmdk 互踢）。 */
  claimImSlot(payload: { claim: ImSlotClaim }): boolean;
  releaseImSlot(payload: { id: string }): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<OctoProtocolMap>();
