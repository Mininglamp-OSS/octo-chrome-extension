import type { MessageContent as WKMessageContent } from "wukongimjssdk";
import { getModule } from "@/messages/core/registry";
import type { SerializedContent } from "@/platform/messaging";

/** 把 plain SerializedContent 还原成 WKSDK MessageContent 子类（用于发消息/跨 context rehydrate） */
export function rehydrateContent(s: SerializedContent): WKMessageContent {
  const mod = getModule(s.type);
  if (!mod) {
    throw new Error(`rehydrateContent: no module for type ${s.type}`);
  }
  return mod.fromUI(s.data);
}
