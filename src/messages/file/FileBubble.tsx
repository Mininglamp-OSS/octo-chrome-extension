import { Download } from "lucide-react";
import { FileTypeIcon, formatFileSize } from "@/components/octo/FileTypeIcon";
import { cn } from "@/utils/cn";
import type { FileContent } from "./FileMessage";

export function FileBubble({ data }: { data: FileContent }) {
  function onDownload(e: React.MouseEvent | React.KeyboardEvent): void {
    e.stopPropagation();
    if (!data.url) return;
    const a = document.createElement("a");
    a.href = data.url;
    a.download = data.name || "file";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function onPreview(): void {
    if (!data.url) return;
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: 内含独立 download 按钮，外层不能再用 button（嵌套违法）
    <div
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onPreview();
      }}
      title="点击预览"
      // inline style 强制 maxWidth + minWidth — 反复试 4 版 Tailwind / CSS 都没收敛，
      // 直接用 React inline style 压过一切 class 规则 / JIT / 缓存问题，必定生效
      style={{ width: "100%", maxWidth: 280, minWidth: 0 }}
      className={cn(
        "octo-msg-file flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left",
        "cursor-pointer",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
        <FileTypeIcon extension={data.extension} name={data.name} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          className="truncate text-sm font-medium leading-snug text-(--color-foreground)"
          title={data.name}
        >
          {data.name || "未知文件"}
        </div>
        <div className="flex items-center gap-2 text-xs text-(--color-muted-foreground)">
          <span>{formatFileSize(data.size)}</span>
          {data.extension && (
            <span className="rounded-sm bg-(--color-primary)/10 px-1 text-[10px] font-semibold leading-[1.6] text-(--color-primary)">
              {data.extension.toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDownload}
        title="下载"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-(--color-primary)",
          "transition-colors hover:bg-(--color-primary)/10",
        )}
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}
