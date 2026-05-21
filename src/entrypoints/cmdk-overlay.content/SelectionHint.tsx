/**
 * 划词浮标 —— 在用户文字选区下方显示「反馈到 Octo」按钮
 */

interface SelectionHintProps {
  rect: DOMRect;
  onClick: () => void;
}

export function SelectionHint({ rect, onClick }: SelectionHintProps) {
  // 计算定位，避免出屏
  const btnW = 100;
  const btnH = 24;
  let top = rect.bottom + 6;
  let left = rect.left + (rect.width - btnW) / 2;
  if (left < 4) left = 4;
  if (left + btnW > window.innerWidth - 4) left = window.innerWidth - btnW - 4;
  if (top + btnH > window.innerHeight - 4) top = rect.top - btnH - 6;
  if (top < 4) top = 4;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[2147483647] flex items-center gap-1 rounded-full bg-(--color-primary) px-3 text-xs font-medium text-(--color-primary-foreground) shadow-lg"
      style={{ top, left, width: btnW, height: btnH }}
    >
      反馈到 Octo
      <span className="ml-1 rounded-sm bg-white/15 px-1 py-px text-[10px]">⌘K</span>
    </button>
  );
}
