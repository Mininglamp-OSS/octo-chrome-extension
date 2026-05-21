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
      className={cn(
        "octo-msg-file flex items-center gap-3 rounded-lg px-3 py-2.5 text-left",
        "min-w-[200px] max-w-[280px] bg-(--color-foreground)/5 cursor-pointer",
        "transition-colors hover:bg-(--color-foreground)/10",
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
