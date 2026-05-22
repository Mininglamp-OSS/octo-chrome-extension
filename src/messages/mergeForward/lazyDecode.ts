import { WKSDK } from "wukongimjssdk";
import { getModuleOrUnknown } from "@/messages/core/registry";
import type { SerializedContent } from "@/platform/messaging";
import type { MergeForwardSubUI } from "./index";

/** 把合并转发里持有的 raw payload 子消息懒解码 + 转 UI，得到 SerializedContent，
 *  下游可以直接喂给 MessageContentView 进行 registry 派发渲染。
 *
 *  注意：本文件 import registry，因此**不能**被 mergeForward/index.ts (模块入口) 引用，
 *  否则会形成 registry ↔ mergeForward 循环。只能由 Bubble / Panel 等 UI 文件 import。 */
export function subToSerialized(sub: MergeForwardSubUI): SerializedContent {
  const type = sub.payload.type;
  try {
    const sdk = WKSDK.shared().getMessageContent(type);
    sdk.decodeJSON(sub.payload);
    const mod = getModuleOrUnknown(sdk.contentType);
    // biome-ignore lint/suspicious/noExplicitAny: SerializedContent 是 discriminated union，框架边界 cast
    return { type: sdk.contentType, data: mod.toUI(sdk) } as any;
  } catch {
    // biome-ignore lint/suspicious/noExplicitAny: 同上
    return { type: -1, data: { type, displayText: "", realType: type } } as any;
  }
}

export function subDigest(sub: MergeForwardSubUI): string {
  const content = subToSerialized(sub);
  const mod = getModuleOrUnknown(content.type);
  try {
    return mod.digest(content.data) || "[消息]";
  } catch {
    return "[消息]";
  }
}
