import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";

export interface DragHandlers {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
}

/**
 * 给一个面板加「按住手柄拖拽」能力。返回当前位移与挂在手柄上的事件。
 * - 用 PointerEvents + setPointerCapture，避免拖出窗口丢失指针
 * - 不让面板拖出可视区（保留 32px 余量），避免拽到屏幕外回不来
 */
export function useDraggable(opts?: { padding?: number }): {
  translate: { x: number; y: number };
  reset: () => void;
  handlers: DragHandlers;
  dragging: boolean;
} {
  const padding = opts?.padding ?? 32;
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ px: number; py: number; tx: number; ty: number } | null>(null);

  const onPointerMove = useCallback(
    (e: globalThis.PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      const dx = e.clientX - s.px;
      const dy = e.clientY - s.py;
      const x = s.tx + dx;
      const y = s.ty + dy;
      const maxX = Math.max(0, window.innerWidth / 2 - padding);
      const maxY = Math.max(0, window.innerHeight / 2 - padding);
      setTranslate({
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      });
    },
    [padding],
  );

  const stop = useCallback(() => {
    startRef.current = null;
    setDragging(false);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      // 仅左键，且点击目标自身或它的子节点（避免按钮 / 输入框被吞）
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("button, input, textarea, a, [data-no-drag]")) return;
      e.preventDefault();
      startRef.current = {
        px: e.clientX,
        py: e.clientY,
        tx: translate.x,
        ty: translate.y,
      };
      setDragging(true);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    },
    [translate.x, translate.y, onPointerMove, stop],
  );

  useEffect(() => () => stop(), [stop]);

  return {
    translate,
    reset: () => setTranslate({ x: 0, y: 0 }),
    handlers: { onPointerDown },
    dragging,
  };
}
