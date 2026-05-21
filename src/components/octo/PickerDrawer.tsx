import { useEffect, type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface PickerDrawerProps {
  open: boolean;
  onClose: () => void;
  /** 右侧让出的 rail 宽度，单位 px，默认 48（mirror = 48） */
  railWidth?: number;
  children: ReactNode;
}

/**
 * mirror wk-sidepanel-picker-drawer / wk-sidepanel-picker-backdrop 等价。
 *
 * 渲染两个 absolute 兄弟元素：
 *  - drawer 覆盖父容器（top:0 left:0 bottom:0 right:railWidth），z-56
 *  - backdrop 蒙在 rail 那 railWidth px（right:0 width:railWidth），z-55，点击关闭
 *
 * 父元素必须 position: relative。始终挂载，靠 data-open 切换 CSS 控制动画
 * （避免 unmount 截断 transition）。
 */
export function PickerDrawer({ open, onClose, railWidth = 48, children }: PickerDrawerProps) {
  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* backdrop：仅蒙住 rail 区域，点击关闭 */}
      <button
        type="button"
        aria-label="关闭会话选择"
        data-open={open ? "true" : "false"}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={cn(
          "absolute top-0 bottom-0 right-0 z-[55] cursor-pointer border-0 bg-black/25 backdrop-blur-[2px]",
          "transition-opacity duration-150 ease-out",
          "data-[open=false]:pointer-events-none data-[open=false]:opacity-0",
          "data-[open=true]:pointer-events-auto data-[open=true]:opacity-100",
        )}
        style={{ width: railWidth }}
      />

      {/* drawer */}
      <div
        data-open={open ? "true" : "false"}
        className={cn(
          "octo-picker-drawer absolute top-0 bottom-0 left-0 z-[56] flex flex-col border-r bg-(--color-background)",
          "data-[open=false]:invisible data-[open=false]:pointer-events-none data-[open=false]:opacity-0 data-[open=false]:-translate-x-2.5",
          "data-[open=true]:visible data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 data-[open=true]:translate-x-0",
        )}
        style={{ right: railWidth }}
      >
        {children}
      </div>
    </>
  );
}
