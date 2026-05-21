import { SystemContent, UnknownContent } from "wukongimjssdk";
import { defineMessageType } from "@/messages/core/defineMessageType";

/**
 * 兜底模块 —— 任何 registry 找不到的 contentType 都走它。
 *
 * 利用 wukongimjssdk 内置的 isSystemMessage 范围 (1000-2000)：SDK 已对该范围内
 * 的 contentType 返回 SystemContent 实例，这里如果检测到就直接渲染 displayText，
 * 这样后端将来加新系统消息（如 1010）我们没注册也能自动显示文案。
 * Render 在 src/messages/renders.tsx 注册。
 */
export interface UnknownUI {
  type: number;
  /** 来自 SystemContent 的服务端文案；其它情形为空 */
  displayText: string;
  /** 来自 UnknownContent 的真实 contentType（SDK 解码失败的那种），其它情形 0 */
  realType: number;
}

export const unknown = defineMessageType({
  type: -1 as const,
  name: "unknown" as const,
  category: "chat" as const,
  sdkFactory: () => new UnknownContent(),
  toUI: (raw) => {
    if (raw instanceof SystemContent) {
      return { type: raw.contentType, displayText: raw.displayText ?? "", realType: 0 };
    }
    if (raw instanceof UnknownContent) {
      return { type: raw.contentType, displayText: "", realType: raw.realContentType };
    }
    return { type: raw.contentType, displayText: "", realType: 0 };
  },
  fromUI: () => new UnknownContent(),
  digest: (data) => data.displayText || "[消息]",
  copyable: "none",
  mentionable: false,
  notifiable: false,
  countsAsUnread: false,
});
