import { sendMessage } from "@/platform/messaging";

interface CmdkLoggedOutNoticeProps {
  /** 关闭 cmdk panel（postMessage CMDK_DONE 给 parent overlay）。 */
  onClose: () => void;
}

/**
 * cmdk 未登录提示卡片。照抄 mirror apps/extension/entrypoints/cmdk/main.tsx 的 LoggedOutNotice。
 *
 * 为什么放在 cmdk iframe 内而不是 content overlay 浮层：
 * cmdk iframe 是扩展 origin（chrome-extension://），里面按钮 click 的 user gesture
 * 能稳定传递到 background → chrome.sidePanel.open()。content script 浮层是网页 origin，
 * 同链路会丢手势，sidepanel 不会开。
 */
export function CmdkLoggedOutNotice({ onClose }: CmdkLoggedOutNoticeProps) {
  function handleOpenSidePanel(): void {
    void sendMessage("requestOpenSidePanel", {}).catch(() => {});
    onClose();
  }

  function handleOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 蒙层关闭语义已有 Esc 兜底
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        role="dialog"
        aria-labelledby="cmdk-loggedout-title"
        className="animate-in slide-in-from-top-4 zoom-in-95 relative w-[360px] max-w-[88vw] overflow-hidden rounded-[22px] border border-(--color-border) bg-(--color-popover) text-(--color-popover-foreground) p-7 text-center shadow-2xl ring-1 ring-white/10 duration-200 dark:ring-white/[0.04]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 顶部柔光 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-32 w-[280px] -translate-x-1/2 rounded-full blur-3xl opacity-60"
          style={{
            background: "radial-gradient(closest-side, rgba(124,92,252,0.35), transparent)",
          }}
        />

        <h2
          id="cmdk-loggedout-title"
          className="relative text-[18px] font-semibold tracking-tight"
        >
          请先登录
        </h2>
        <p className="relative mt-2 text-[13px] text-(--color-muted-foreground)">
          登录后即可使用 Octo 划词功能。
        </p>

        <div className="relative mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleOpenSidePanel}
            autoFocus
            className="inline-flex h-[38px] items-center justify-center gap-2 rounded-[12px] bg-(--color-primary) text-[13.5px] font-medium text-white transition-transform hover:translate-y-[-1px] hover:shadow-lg active:translate-y-0"
          >
            <span>打开侧边栏登录</span>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M3 8h10m0 0L9 4m4 4L9 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[36px] items-center justify-center rounded-[12px] bg-(--color-muted)/50 text-[12.5px] font-medium text-(--color-muted-foreground) transition-colors hover:bg-(--color-muted)/70"
          >
            稍后
          </button>
        </div>

        <div className="relative mt-5 flex items-center justify-center gap-1.5 text-[11px] text-(--color-muted-foreground)">
          <span className="rounded border border-(--color-border) bg-(--color-muted)/40 px-1.5 py-0.5 font-mono text-[10px]">
            Esc
          </span>
          <span>关闭</span>
        </div>
      </div>
    </div>
  );
}
