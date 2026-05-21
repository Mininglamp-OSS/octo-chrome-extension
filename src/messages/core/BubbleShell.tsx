import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

/** 通用气泡外壳：text / unknown 等单体内容用 */
export function BubbleShell({ isSelf, children }: { isSelf: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "octo-msg-bubble-shell rounded-2xl px-3 py-2",
        isSelf
          ? "bg-(--color-foreground) text-(--color-background)"
          : "bg-(--color-muted) text-(--color-foreground)",
      )}
    >
      {children}
    </div>
  );
}
