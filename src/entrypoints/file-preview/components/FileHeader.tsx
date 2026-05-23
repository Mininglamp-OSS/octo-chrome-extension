import { Download } from "lucide-react";
import { formatFileSize } from "@/components/octo/FileTypeIcon";
import { Button } from "@/components/ui/button";

interface Props {
  name: string;
  size: number;
  extLabel: string;
  url: string;
}

export function FileHeader({ name, size, extLabel, url }: Props) {
  function onDownload(): void {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-(--color-border) bg-(--color-background)/85 px-6 py-3 backdrop-blur">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold" title={name}>
          {name}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-(--color-muted-foreground)">
          {extLabel && (
            <span className="rounded-sm bg-(--color-primary)/10 px-1 text-[10px] font-semibold leading-[1.6] text-(--color-primary) uppercase">
              {extLabel}
            </span>
          )}
          {size > 0 && <span>{formatFileSize(size)}</span>}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onDownload}>
        <Download className="mr-1 h-3.5 w-3.5" /> 下载
      </Button>
    </header>
  );
}
