import { useState } from "react";

/** 划词浮标 —— 文字选区旁的「反馈到 Octo ⌘K」渐变药丸 */

interface SelectionHintProps {
  rect: DOMRect;
  onClick: () => void;
}

const BTN_W = 140;
const BTN_H = 28;

export function SelectionHint({ rect, onClick }: SelectionHintProps) {
  const [hover, setHover] = useState(false);

  // 临时调试：默认放在选区「上方」，避免和 cmd k 面板调试时互相挡。
  // 上方空间不够才回落到下方。
  let top = rect.top - BTN_H - 6;
  if (top < 4) top = rect.bottom + 6;
  let left = rect.left + (rect.width - BTN_W) / 2;
  if (left < 4) left = 4;
  if (left + BTN_W > window.innerWidth - 4) left = window.innerWidth - BTN_W - 4;
  if (top + BTN_H > window.innerHeight - 4) top = window.innerHeight - BTN_H - 4;
  if (top < 4) top = 4;

  return (
    <button
      type="button"
      title="反馈给 Octo · 或按 ⌘K"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 2147483647,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        borderRadius: 999,
        background: "linear-gradient(135deg, #7C5CFC 0%, #00D4AA 100%)",
        color: "white",
        fontSize: 12,
        fontWeight: 500,
        boxShadow: hover
          ? "0 10px 22px rgba(124, 92, 252, 0.5), 0 2px 4px rgba(0, 0, 0, 0.16)"
          : "0 6px 18px rgba(124, 92, 252, 0.4), 0 1px 2px rgba(0, 0, 0, 0.14)",
        cursor: "pointer",
        border: 0,
        lineHeight: 1,
        whiteSpace: "nowrap",
        opacity: hover ? 1 : 0.96,
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        transition:
          "transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease",
        animation: "octo-hint-in 180ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* 实心气泡 icon —— fill currentColor，圆润饱满风格 */}
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="currentColor"
        role="img"
        aria-label="对话"
      >
        <title>对话</title>
        <path d="M12 3C7.03 3 3 6.36 3 10.5c0 2.31 1.28 4.36 3.27 5.74-.1.97-.51 2.46-1.39 3.55-.2.25.02.6.34.55 1.84-.32 4.18-1.17 5.55-2.04.39.05.79.07 1.2.07 4.97 0 9-3.36 9-7.5S16.97 3 12 3z" />
      </svg>
      <span style={{ letterSpacing: "0.01em" }}>反馈到 Octo</span>
      <span
        style={{
          padding: "2px 5px",
          fontSize: 10,
          borderRadius: 3,
          background: "rgba(255,255,255,0.22)",
          fontWeight: 500,
          letterSpacing: "0.02em",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        ⌘K
      </span>
      <style>{`@keyframes octo-hint-in {
        from { opacity: 0; transform: translateY(4px) scale(0.92); }
        to   { opacity: 0.96; transform: translateY(0) scale(1); }
      }`}</style>
    </button>
  );
}
