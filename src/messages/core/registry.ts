import WKSDK from "wukongimjssdk";
import type { AnyMessageModule, MessageRender } from "@/messages/core/defineMessageType";
import { file } from "@/messages/file";
import { image } from "@/messages/image";
import { lottieSticker } from "@/messages/lottieSticker";
import { addMembers } from "@/messages/system/addMembers";
import { approveGroupMember } from "@/messages/system/approveGroupMember";
import { channelUpdate } from "@/messages/system/channelUpdate";
import { createGroup } from "@/messages/system/createGroup";
import { newGroupOwner } from "@/messages/system/newGroupOwner";
import { removeMembers } from "@/messages/system/removeMembers";
import { threadCreated } from "@/messages/system/threadCreated";
import { text } from "@/messages/text";
import { unknown } from "@/messages/unknown";
import { voice } from "@/messages/voice";

/**
 * 单一来源 —— 加新消息类型 = 在这个数组里加一行（再加上对应模块文件）。
 * 顺序无关，但保持「chat 类在前、system 类在后」便于扫读。
 */
export const MESSAGE_TYPES = [
  // chat
  text,
  image,
  voice,
  file,
  lottieSticker,
  // system (1000-2000 段)
  createGroup, // 1001
  addMembers, // 1002
  removeMembers, // 1003
  channelUpdate, // 1005
  newGroupOwner, // 1008
  approveGroupMember, // 1009
  threadCreated, // 1100
] as const;

type Modules = typeof MESSAGE_TYPES;
export type RegisteredModule = Modules[number];

const map = new Map<number, AnyMessageModule>(MESSAGE_TYPES.map((m) => [m.type, m]));

export function getModule(type: number): AnyMessageModule | undefined {
  return map.get(type);
}

/** 找不到时回退到 unknown 模块 —— 它内部会自动识别 SystemContent */
export function getModuleOrUnknown(type: number): AnyMessageModule {
  return map.get(type) ?? (unknown as AnyMessageModule);
}

export function allModules(): readonly AnyMessageModule[] {
  return MESSAGE_TYPES as readonly AnyMessageModule[];
}

/* ============================================================
 * 派生类型 / 常量 —— 加模块自动同步，不需要在别处手维护
 * ============================================================ */

/** 跨 context 序列化形态。@webext-core/messaging 直接消费这个类型 */
export type SerializedContent = {
  [K in RegisteredModule as K["type"]]: { type: K["type"]; data: ReturnType<K["toUI"]> };
}[RegisteredModule["type"]];

/** 命名常量：保留 `MessageContentType.text` 风格的调用便利性 */
export const MessageContentType = Object.fromEntries(
  MESSAGE_TYPES.map((m) => [m.name, m.type]),
) as { readonly [K in RegisteredModule as K["name"]]: K["type"] };

/* ============================================================
 * 模块加载时自动把所有 sdkFactory 注册到 WKSDK —— 保证任何 importer 都拿得到
 * 正确的 SDK 子类实例（包括 vitest node 环境，不依赖 setupIm 被调用过）。
 * SDK 的 register 是 idempotent 的（Map.set 覆盖同 key），多次调用安全。
 * ============================================================ */
{
  const sdk = WKSDK.shared();
  for (const mod of MESSAGE_TYPES) {
    sdk.register(mod.type, mod.sdkFactory);
  }
}

/* ============================================================
 * Render 注册表（UI 专用）
 * 模块入口只导出元数据 —— Render 组件通过 `registerRender(type, Comp)`
 * 在 UI context 启动时显式注册（src/messages/registerRenders.tsx）。
 * background SW 不调 registerRenders，所以不会拽进 react-markdown 等 UI 链。
 * ============================================================ */
const renderMap = new Map<number, MessageRender>();

export function registerRender<TUI>(type: number, render: MessageRender<TUI>): void {
  renderMap.set(type, render as MessageRender);
}

export function getRender(type: number): MessageRender | undefined {
  return renderMap.get(type);
}
