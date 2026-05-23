import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getApiUrl } from "@/api/client";
import { useSpaceMembers } from "@/api/queries/spaces";
import {
  CmdkChannelPicker,
  type PickedTarget,
} from "@/cmdk/CmdkChannelPicker";
import { CmdkComposer, type CmdkComposerHandle } from "@/cmdk/CmdkComposer";
import { CmdkLoggedOutNotice } from "@/cmdk/CmdkLoggedOutNotice";
import { CmdkTopBar } from "@/cmdk/CmdkTopBar";
import type { PanelContext } from "@/cmdk/buildCmdkMessageText";
import { isInsidePortal } from "@/cmdk/overlaySelectors";
import { useDraggable } from "@/cmdk/useDraggable";
import { ChannelType } from "@/const/channel";
import { cmdkLastTargetStorage } from "@/platform/storage";
import { selectIsLogined, useAuthStore } from "@/stores/auth";
import { useSpaceStore } from "@/stores/space";
import { resolveImageURL, stripSpacePrefix } from "@/utils/avatar";
import { cn } from "@/utils/cn";

const READY_MSG = "CMDK_READY";
const CONTEXT_MSG = "CMDK_CONTEXT";
const DONE_MSG = "CMDK_DONE";
const LONG_QUOTE_THRESHOLD = 500;

const EMPTY_CTX: PanelContext = {
  selectedText: "",
  pageUrl: "",
  pageTitle: "",
  hostname: "",
};

const PANEL_SHADOW_REST =
  "0 24px 60px rgba(20, 20, 28, 0.22), 0 8px 24px rgba(20, 20, 28, 0.12)";
const PANEL_SHADOW_DRAG =
  "0 24px 60px rgba(20, 20, 28, 0.22), 0 8px 24px rgba(20, 20, 28, 0.12), 0 0 0 1px rgba(124, 92, 252, 0.28), 0 0 0 5px rgba(124, 92, 252, 0.08)";

const DONE_PARENT_MSG = DONE_MSG;

/**
 * CmdkApp 顶层 gate：未登录 → 渲染 CmdkLoggedOutNotice；登录 → 渲染主体 CmdkAppAuthed。
 *
 * 未登录拦截放在这里（cmdk iframe 内）而不是 content overlay 浮层，是因为
 * iframe 是扩展 origin，里面按钮 onClick 的 user gesture 能稳定传递到
 * background → chrome.sidePanel.open()；content script 里则会丢手势。
 * 与 mirror apps/extension/entrypoints/cmdk/main.tsx 同款方案。
 */
export function CmdkApp() {
  const isLogined = useAuthStore(selectIsLogined);

  function notifyParentClose(): void {
    window.parent?.postMessage({ type: DONE_PARENT_MSG }, "*");
  }

  // Esc 关闭 + 通知 overlay 拆 iframe（无论登录与否都需要）
  useEffect(() => {
    if (isLogined) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        notifyParentClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLogined]);

  if (!isLogined) {
    return <CmdkLoggedOutNotice onClose={notifyParentClose} />;
  }
  return <CmdkAppAuthed />;
}

function CmdkAppAuthed() {
  const [ctx, setCtx] = useState<PanelContext>(EMPTY_CTX);
  const [picked, setPicked] = useState<PickedTarget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const composerRef = useRef<CmdkComposerHandle | null>(null);
  const sentRef = useRef(false);
  const drag = useDraggable();
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  const { data: members } = useSpaceMembers(spaceId);
  const memberAvatarByUid = useMemo(() => {
    const m = new Map<string, string>();
    for (const sm of members ?? []) {
      if (sm.avatar?.trim()) m.set(sm.uid, sm.avatar.trim());
    }
    return m;
  }, [members]);

  // 私聊 picked target 头像可能被旧 storage 毒了（fallback URL 404），用 space member 现刷一遍
  useEffect(() => {
    if (!picked || picked.channelType !== ChannelType.person) return;
    if (memberAvatarByUid.size === 0) return;
    const uid = stripSpacePrefix(picked.channelId, spaceId);
    const real = memberAvatarByUid.get(uid);
    if (!real) return;
    const resolved = resolveImageURL(getApiUrl(), real);
    if (resolved && resolved !== picked.avatar) {
      setPicked({ ...picked, avatar: resolved });
    }
  }, [picked, memberAvatarByUid, spaceId]);

  const longSel = ctx.selectedText.length > LONG_QUOTE_THRESHOLD;

  // 1) 接收 parent 的初始 context；2) 通知 parent 就绪
  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      const data = (e.data ?? {}) as { type?: string; payload?: PanelContext };
      if (data.type === CONTEXT_MSG && data.payload) {
        setCtx({ ...EMPTY_CTX, ...data.payload });
      }
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: READY_MSG }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    void cmdkLastTargetStorage.getValue().then((t) => {
      if (t) setPicked(t);
    });
  }, []);

  function close(): void {
    if (sentRef.current) return;
    sentRef.current = true;
    window.parent?.postMessage({ type: DONE_MSG }, "*");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !pickerOpen) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  function handleMaskMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target !== e.currentTarget) return;
    if (isInsidePortal(e.target)) return;
    close();
  }

  function handleDragOver(e: React.DragEvent): void {
    e.preventDefault();
  }
  function handleDrop(e: React.DragEvent): void {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) composerRef.current?.addFiles(files);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 全屏区域，关闭语义已由 Esc 兜底
    <div
      className="animate-in fade-in fixed inset-0 z-50 flex items-start justify-center bg-transparent pt-[11vh] duration-150"
      onMouseDown={handleMaskMouseDown}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 面板容器仅作拖拽 + 投放容器 */}
      <div
        className={cn(
          "animate-in slide-in-from-top-4 zoom-in-95 relative flex max-h-[82vh] w-[580px] max-w-[92vw] flex-col overflow-hidden rounded-[22px] border border-(--color-border) bg-(--color-popover) text-(--color-popover-foreground) ring-1 ring-white/10 duration-200 dark:ring-white/[0.04]",
        )}
        style={{
          transform: `translate3d(${drag.translate.x}px, ${drag.translate.y}px, 0)`,
          boxShadow: drag.dragging ? PANEL_SHADOW_DRAG : PANEL_SHADOW_REST,
          animationTimingFunction: "cubic-bezier(0.2, 0.9, 0.2, 1)",
          animationDuration: "220ms",
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <CmdkTopBar
          target={picked}
          onPickTarget={() => setPickerOpen((v) => !v)}
          onClose={close}
          dragHandlers={drag.handlers}
          dragging={drag.dragging}
        />

        <div className="shrink-0">
          <CmdkComposer
            ref={composerRef}
            picked={picked}
            ctx={ctx}
            longSel={longSel}
            onSent={close}
            onSendingChange={setSending}
          />
        </div>

        {pickerOpen && (
          <CmdkChannelPicker
            current={picked}
            onPick={(t) => {
              setPicked(t);
              setPickerOpen(false);
            }}
            onCancel={() => setPickerOpen(false)}
          />
        )}

        {sending && (
          <div className="animate-in fade-in absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-(--color-popover)/85 backdrop-blur-[2px] duration-150">
            <Loader2 className="h-7 w-7 animate-spin text-(--color-primary)" />
            <span className="text-[13px] text-(--color-muted-foreground)">
              {longSel ? "正在转换为 .md 并发送…" : "发送中…"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
