import type { ComponentType } from "react";
import type { Message as SDKMessage, MessageContent as WKMessageContent } from "wukongimjssdk";

export type MessageCategory = "chat" | "system";

/** UI Render 组件签名（独立导出，供 registerRenders 使用） */
export type MessageRender<TUI = unknown> = ComponentType<{ data: TUI; ctx: MessageRenderCtx }>;

/** 渲染上下文 —— 只暴露纯数据字段，避免 SDK 类型泄漏到 components/ */
export interface MessageRenderCtx {
  isSelf: boolean;
  channelId: string;
  channelType: number;
  fromUid: string;
  messageId: string;
}

export interface MessageTypeModule<
  Type extends number = number,
  Name extends string = string,
  TUI = unknown,
> {
  readonly type: Type;
  readonly name: Name;
  /** chat = 头像气泡行；system = 居中胶囊（父布局只读这个 flag 决定外壳） */
  readonly category: MessageCategory;

  /* === 边界转换：wire (JSON) ↔ SDK 实例 ↔ UI (plain object) === */
  sdkFactory: () => WKMessageContent;
  toUI: (sdk: WKMessageContent) => TUI;
  /** 必填项：发消息 + 跨 context rehydrate 都靠它。系统消息也需要（撤回/回放） */
  fromUI: (data: TUI) => WKMessageContent;

  /* === 渲染 ===
   * UI Render 改为延迟注册：模块入口（messages/<type>/index.ts）只导出 core 元数据
   * （digest/notifiable/sdkFactory/toUI/fromUI），Render 通过 `registerRender(type, Comp)`
   * 在 UI context 启动时注册（见 src/messages/registerRenders.tsx）。
   * 这样 background service worker 间接 import registry 时不会拽进 react-markdown 等
   * 仅 UI 用的组件链（顶层访问 document 会让 SW 启动失败）。
   */
  /** 会话列表 / 通知 / reply 预览 三处共用 */
  digest: (data: TUI) => string;

  /* === 行为 flag（在调用方读，默认值见 normalize/默认分支） === */
  copyable?: "text" | "none";
  mentionable?: boolean;
  notifiable?: boolean;
  countsAsUnread?: boolean;

  /** live message 到达时由 client.ts 中央 listener 包 try/catch 后派发 */
  onReceive?: (msg: SDKMessage) => void;
}

export function defineMessageType<Type extends number, Name extends string, TUI>(
  m: MessageTypeModule<Type, Name, TUI>,
): MessageTypeModule<Type, Name, TUI> {
  return m;
}

/**
 * 框架内部使用的"宽视图" —— 用 any 屏蔽 TUI 协变/逆变冲突
 * (调用方 `mod.fromUI(serializedData)` 在 framework 边界本来就跨类型，TS 无法约束)。
 * 应用代码不应当依赖 AnyMessageModule —— 想要类型安全请用 `RegisteredModule`。
 */
// biome-ignore lint/suspicious/noExplicitAny: framework-side view, must be permissive
export type AnyMessageModule = MessageTypeModule<number, string, any>;
