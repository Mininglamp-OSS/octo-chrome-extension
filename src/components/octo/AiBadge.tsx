import { cn } from "@/utils/cn";

interface AiBadgeProps {
  className?: string;
  /** sm: 用于小列表项 / chip；md: 默认，用于常规列表 */
  size?: "sm" | "md";
}

/**
 * AI 标识徽章 —— 紫调渐变，用在 bot 用户名字旁边。
 * 视觉来源：cmdk @ mention 列表（mention.tsx 现已复用本组件）。
 */
export function AiBadge({ className, size = "md" }: AiBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center rounded-[3px] font-semibold leading-none text-white",
        size === "sm" ? "h-3.5 px-[3px] text-[9px]" : "h-4 px-1 text-[10px]",
        className,
      )}
      style={{ background: "linear-gradient(90deg, #7B89F4 0%, #9D78F5 100%)" }}
      title="AI"
    >
      AI
    </span>
  );
}
