import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/cn";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  /** 顶部图标。传 null 隐藏；undefined 时 destructive 默认用 AlertTriangle */
  icon?: React.ReactNode | null;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  variant = "default",
  onConfirm,
  icon,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const isDestructive = variant === "destructive";

  async function handleConfirm(): Promise<void> {
    if (busy) return;
    try {
      setBusy(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  const finalIcon =
    icon === null
      ? null
      : (icon ??
        (isDestructive ? (
          <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={2.25} />
        ) : null));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50",
            "bg-black/40 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:duration-200 data-[state=closed]:duration-150",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50",
            "w-[300px] max-w-[calc(100vw-32px)]",
            "-translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-2xl",
            "border border-(--color-border)/70",
            "bg-(--color-background)",
            "shadow-[0_20px_50px_-12px_rgba(0,0,0,0.22),0_8px_16px_-8px_rgba(0,0,0,0.10)]",
            "ring-1 ring-black/[0.03] dark:ring-white/[0.04]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:slide-in-from-top-1",
            "data-[state=open]:duration-200 data-[state=closed]:duration-150",
            "ease-out",
          )}
        >
          {/* 内容区：图标 → 标题 → 描述，居中收敛 */}
          <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
            {finalIcon && (
              <div
                className={cn(
                  "mb-3 flex h-10 w-10 items-center justify-center rounded-full",
                  isDestructive
                    ? "bg-(--color-destructive)/10 text-(--color-destructive)"
                    : "bg-(--color-primary)/10 text-(--color-primary)",
                )}
              >
                {finalIcon}
              </div>
            )}
            <DialogPrimitive.Title className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-(--color-foreground)">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1.5 max-w-[240px] text-[12.5px] leading-[1.55] text-(--color-muted-foreground)">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>

          {/* 底部双按钮：等宽 + 中分割线 + 顶部分割线，iOS/Raycast 同款 */}
          <div className="grid grid-cols-2 divide-x divide-(--color-border)/70 border-t border-(--color-border)/70">
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenChange(false)}
              className={cn(
                "h-11 text-[13px] font-medium",
                "text-(--color-muted-foreground)",
                "transition-colors duration-100",
                "hover:bg-(--color-muted)/40 hover:text-(--color-foreground)",
                "active:bg-(--color-muted)/60",
                "focus-visible:bg-(--color-muted)/50 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {cancelText}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirm()}
              className={cn(
                "h-11 text-[13px] font-semibold",
                "transition-colors duration-100",
                "focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                isDestructive
                  ? "text-(--color-destructive) hover:bg-(--color-destructive)/10 focus-visible:bg-(--color-destructive)/10 active:bg-(--color-destructive)/15"
                  : "text-(--color-primary) hover:bg-(--color-primary)/10 focus-visible:bg-(--color-primary)/10 active:bg-(--color-primary)/15",
              )}
            >
              {confirmText}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
