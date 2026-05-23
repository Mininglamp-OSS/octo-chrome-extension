import { useEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import type { PanelContext } from "./buildCmdkMessageText";
import type { ResolvedApp } from "./urlApps";

interface CmdkQuoteBlockProps {
  ctx: PanelContext;
  app: ResolvedApp;
  /** picker 打开时收紧高度，给 picker 让位；切换时 reset scrollTop 让用户看到选段开头 */
  compact?: boolean;
}

const TITLE_DISPLAY_LIMIT = 60;
const LONG_QUOTE_THRESHOLD = 500;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function CmdkQuoteBlock({ ctx, app, compact = false }: CmdkQuoteBlockProps) {
  const hasSelection = !!ctx.selectedText;
  const longSel = ctx.selectedText.length > LONG_QUOTE_THRESHOLD;
  const title = ctx.pageTitle?.trim() || ctx.hostname || ctx.pageUrl;
  const textRef = useRef<HTMLDivElement>(null);

  // 进入 compact 时把内部滚动复位到顶部，让用户在压缩视图下默认看到选段开头
  useEffect(() => {
    if (compact && textRef.current) {
      textRef.current.scrollTop = 0;
    }
  }, [compact]);

  return (
    <div className="relative shrink-0 overflow-hidden rounded-2xl bg-(--color-muted)/40 pl-5 pr-4 pt-3 pb-3 dark:bg-(--color-background)/70">
      {/* 3px 紫色左 ribbon */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-2 top-3 bottom-3 w-[3px] rounded-full"
        style={{ background: "linear-gradient(180deg, #7C5CFC, #5B7BFF)" }}
      />

      {/* meta 行 */}
      <div className="flex min-w-0 items-center gap-2 text-[11.5px] text-(--color-muted-foreground)">
        <span
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md bg-(--color-muted)/70 text-[11px] leading-none"
          aria-hidden
        >
          {app.icon}
        </span>
        <a
          href={ctx.pageUrl || "#"}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 truncate text-[13px] font-semibold text-(--color-foreground) hover:underline"
          title={title}
        >
          {truncate(title || "", TITLE_DISPLAY_LIMIT)}
        </a>
        {hasSelection && (
          <>
            <span className="shrink-0">·</span>
            <span className="shrink-0 tabular-nums">选中 {ctx.selectedText.length} 字</span>
          </>
        )}
        {longSel && (
          <>
            <span className="shrink-0">·</span>
            <span className="shrink-0 text-amber-600 dark:text-amber-400">
              将作为 .md 文件发送
            </span>
          </>
        )}
      </div>

      {hasSelection && (
        <div className="relative mt-2">
          <div
            ref={textRef}
            className={cn(
              "overflow-y-auto overscroll-contain whitespace-pre-wrap pr-1 text-[13px] leading-[1.65] text-(--color-foreground)/85 transition-[max-height] duration-300 ease-out",
              compact ? "max-h-[140px]" : "max-h-[420px]",
            )}
          >
            {ctx.selectedText}
          </div>
          {/* 底部渐变 mask，提示「还有内容」 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-(--color-muted)/40 to-transparent dark:from-(--color-background)/70"
          />
        </div>
      )}
    </div>
  );
}
