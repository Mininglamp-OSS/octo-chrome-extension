import type { MessageRenderCtx } from "@/messages/core/defineMessageType";
import { getRender } from "@/messages/core/registry";
import type { SerializedContent } from "@/platform/messaging";

/**
 * 消息内容渲染入口 —— 仅做 registry 查找 + 派发，不再 switch case。
 * 加新消息类型 = 在 src/messages/<name>/ 写模块 + registry 数组加一行
 *   + src/messages/renders.tsx 注册 Render。
 *
 * 父布局（system 居中 vs chat 气泡行）由 MessageBubble 根据 mod.category 决定。
 */
export function MessageContentView({
  content,
  ctx,
}: {
  content: SerializedContent;
  ctx: MessageRenderCtx;
}) {
  // 优先按 type 查；不存在的 type 由 registerAllRenders 统一注册到 -1（unknown）兜底。
  const Render = (getRender(content.type) ?? getRender(-1)) as React.ComponentType<{
    data: unknown;
    ctx: MessageRenderCtx;
  }>;
  return <Render data={content.data} ctx={ctx} />;
}
