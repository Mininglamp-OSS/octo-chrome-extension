import { type Message as SDKMessage, SystemContent } from "wukongimjssdk";
import { defineMessageType, type MessageTypeModule } from "@/messages/core/defineMessageType";

export interface SystemMessageUI {
  /** 服务端 SystemContent.displayText（已替换 {0} {1} 占位符） */
  displayText: string;
  /** 透传服务端原始 content（特殊系统消息从中读字段，如 1009 的 invite_no） */
  payload: Record<string, unknown>;
}

/**
 * 系统消息工厂 —— 大部分 1000-2000 段的系统消息只需要传 type + name 即可。
 * 服务端在 payload 下发 display_text；前端只渲染该字符串，不自己拼模板（避免与服务端文案漂移）。
 * Render 由 src/messages/renders.tsx 在 UI 端统一注册（默认 SystemPill；个别 type 可覆盖）。
 */
export function defineSystemMessage<Type extends number, Name extends string>(opts: {
  type: Type;
  name: Name;
  onReceive?: (msg: SDKMessage) => void;
}): MessageTypeModule<Type, Name, SystemMessageUI> {
  return defineMessageType({
    type: opts.type,
    name: opts.name,
    category: "system",
    sdkFactory: () => new SystemContent(),
    toUI: (raw) => {
      const c = raw as SystemContent;
      const inner =
        (c.content as Record<string, unknown> | null | undefined) ??
        ({} as Record<string, unknown>);
      return { displayText: c.displayText ?? "", payload: inner };
    },
    fromUI: (data) => {
      const c = new SystemContent();
      // 用公开 decodeJSON 注入：SystemContent.displayText 是从 content["content"] + extra 派生的 getter
      const payload = { ...data.payload, content: data.displayText };
      c.decodeJSON(payload);
      return c;
    },
    digest: (data) => data.displayText || "[系统消息]",
    copyable: "none",
    mentionable: false,
    notifiable: false,
    countsAsUnread: false,
    ...(opts.onReceive ? { onReceive: opts.onReceive } : {}),
  });
}
