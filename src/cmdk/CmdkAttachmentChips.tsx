import { File as FileIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/utils/cn";

interface CmdkAttachmentChipsProps {
  items: File[];
  onRemove: (idx: number) => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function ext(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

function keyOf(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="移除"
      className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/60 text-white shadow-md transition-colors hover:bg-black/80"
    >
      <X className="h-3 w-3" strokeWidth={2.4} />
    </button>
  );
}

function ImageThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={file.name}
      className="h-full w-full object-cover"
      draggable={false}
    />
  );
}

export function CmdkAttachmentChips({ items, onRemove }: CmdkAttachmentChipsProps) {
  // 按原 index 拆分，方便 onRemove 用回原索引
  const partitioned = useMemo(() => {
    const images: Array<{ file: File; idx: number }> = [];
    const files: Array<{ file: File; idx: number }> = [];
    items.forEach((f, idx) => {
      if (f.type.startsWith("image/")) images.push({ file: f, idx });
      else files.push({ file: f, idx });
    });
    return { images, files };
  }, [items]);

  if (items.length === 0) return null;
  return (
    <div className="flex max-h-[120px] shrink-0 flex-col gap-2 overflow-y-auto overscroll-contain px-[18px] pt-3">
      {partitioned.images.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {partitioned.images.map(({ file, idx }) => (
            <div
              key={keyOf(file)}
              className={cn(
                "group relative shrink-0 overflow-hidden rounded-2xl border border-(--color-border)/60 bg-(--color-muted)/30",
                "h-[72px] w-[72px]",
              )}
              title={file.name}
            >
              <ImageThumb file={file} />
              <RemoveBtn onClick={() => onRemove(idx)} />
            </div>
          ))}
        </div>
      )}
      {partitioned.files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {partitioned.files.map(({ file, idx }) => (
            <div
              key={keyOf(file)}
              className="group relative flex max-w-[260px] items-center gap-2 rounded-2xl border border-(--color-border)/60 bg-(--color-muted)/30 py-2 pl-2 pr-9"
              title={file.name}
            >
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-(--color-muted)/60 text-(--color-muted-foreground)">
                <FileIcon className="h-4 w-4" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[12.5px] font-medium leading-tight">
                  {file.name || "file"}
                </span>
                <span className="truncate text-[10.5px] text-(--color-muted-foreground) tabular-nums">
                  {(ext(file.name) || "file").toUpperCase()} · {formatBytes(file.size)}
                </span>
              </div>
              <RemoveBtn onClick={() => onRemove(idx)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
