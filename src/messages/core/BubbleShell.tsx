import type { ReactNode } from "react";

/**
 * 通用气泡内壳。
 * 视觉（bg / padding / radius / self vs other）由外层 `.octo-msg-bubble` 统一控制
 * （见 globals.css 中 `[data-layout="message"] .octo-msg-bubble--self/--other` 规则），
 * 这里只保留 `.octo-msg-bubble-shell` 类，供 CLI 阅读模式切换样式时定位文本节点。
 */
export function BubbleShell({ children }: { isSelf: boolean; children: ReactNode }) {
  return <div className="octo-msg-bubble-shell">{children}</div>;
}
