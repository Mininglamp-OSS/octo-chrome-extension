import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

/**
 * 系统消息胶囊 —— 居中布局由 MessageBubble 在父层提供（category === 'system'），
 * 这里只负责胶囊本身。children 用于扩展自定义动作（如 1009 的「去审核」按钮）。
 */
export function SystemPill({
  displayText,
  children,
  className,
}: {
  displayText: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-(--color-muted)/60 px-3 py-1",
        "text-[11px] leading-normal text-(--color-muted-foreground)",
        "whitespace-pre-line break-words text-center",
        className,
      )}
    >
      <span>{displayText}</span>
      {children}
    </span>
  );
}
