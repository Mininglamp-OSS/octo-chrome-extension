import { storage } from "wxt/utils/storage";

/**
 * 集中定义所有 chrome.storage key。命名空间用 `octo:extension:` 与 mirror 的 `dmwork:extension:`
 * 区分开 —— 新装的用户从干净状态开始，不残留旧版本数据。
 */

export interface AuthState {
  /** wukongim 服务端下发的 token */
  token: string;
  uid: string;
  name?: string;
  shortNo?: string;
  sex?: number;
  role?: string;
  loggedIn: boolean;
  /** 后端 API URL —— 允许从 options 覆盖 */
  apiUrl?: string;
  /** 登录时刻，用于 UI 展示 / 调试 */
  loggedInAt?: number;
}

export interface PendingConversation {
  channelId: string;
  channelType: number;
  source?: string;
}

export interface Preferences {
  /** 自定义 API 根地址；空表示走默认 */
  apiUrl: string;
  /** 阅读模式：消息版（默认气泡）/ 简化版（终端风紧凑） —— 对齐 mirror data-layout */
  layout: "message" | "cli";
  /** 总开关：未读时是否在工具栏图标上点亮红点 */
  notificationsEnabled: boolean;
  /** 子开关：是否额外弹出系统桌面通知（依赖上面的总开关） */
  notificationsVisible: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  apiUrl: "",
  layout: "message",
  notificationsEnabled: true,
  notificationsVisible: true,
};

export const authStorage = storage.defineItem<AuthState | null>("local:octo:extension:auth-state", {
  fallback: null,
});

export const pendingConversationStorage = storage.defineItem<PendingConversation | null>(
  "local:octo:extension:pending-conversation",
  { fallback: null },
);

export const preferencesStorage = storage.defineItem<Preferences>(
  "sync:octo:extension:preferences",
  { fallback: DEFAULT_PREFERENCES },
);

export type ThemeMode = "light" | "dark" | "system";

export const themeStorage = storage.defineItem<ThemeMode>("local:octo:extension:theme", {
  fallback: "system",
});

/** 设备 ID —— 首次登录时生成 UUID，持久化以便后端识别同一设备 */
export const deviceIdStorage = storage.defineItem<string>("local:octo:extension:device-id", {
  fallback: "",
});

/** Cmdk 最近选择的目标 —— 让用户连续划词反馈时不必每次重新选 */
export interface CmdkLastTarget {
  channelId: string;
  channelType: number;
  name: string;
  avatar?: string;
}
export const cmdkLastTargetStorage = storage.defineItem<CmdkLastTarget | null>(
  "local:octo:extension:cmdk-last-target",
  { fallback: null },
);
