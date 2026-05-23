import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getApiUrl } from "@/api/client";
import { useMyBots } from "@/api/queries/contacts";
import { useSpaceMembers } from "@/api/queries/spaces";
import { CmdkAttachmentChips } from "@/cmdk/CmdkAttachmentChips";
import {
  CmdkChannelPicker,
  type PickedTarget,
} from "@/cmdk/CmdkChannelPicker";
import {
  type CmdkComposerHandle,
  CmdkComposerSlot,
} from "@/cmdk/CmdkComposerSlot";
import { CmdkQuoteBlock } from "@/cmdk/CmdkQuoteBlock";
import { CmdkTopBar } from "@/cmdk/CmdkTopBar";
import { buildCmdkMessageText, type PanelContext } from "@/cmdk/buildCmdkMessageText";
import { buildSelectionMarkdownFile } from "@/cmdk/buildSelectionMarkdownFile";
import { isInsidePortal } from "@/cmdk/overlaySelectors";
import { getSendErrorMessage, withSendAck } from "@/cmdk/sendAck";
import { resolveApp } from "@/cmdk/urlApps";
import { useDraggable } from "@/cmdk/useDraggable";
import { validateAttachments } from "@/components/composer/composerLimits";
import { ChannelType } from "@/const/channel";
import { useImConnectionStatus } from "@/im/hooks/useImConnectionStatus";
import { ConnectStatus } from "@/im/proxy";
import { sendFile, sendImage, sendText } from "@/im/send";
import { sendMessage } from "@/platform/messaging";
import { cmdkLastTargetStorage } from "@/platform/storage";
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

export function CmdkApp() {
  const [ctx, setCtx] = useState<PanelContext>(EMPTY_CTX);
  const [picked, setPicked] = useState<PickedTarget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const composerRef = useRef<CmdkComposerHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sentRef = useRef(false);
  const status = useImConnectionStatus();
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

  const app = resolveApp(ctx.pageUrl, ctx.hostname);
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

  function addFiles(incoming: File[]): void {
    const { accepted, rejected } = validateAttachments(attachments, incoming);
    if (rejected.length > 0) {
      const reasons = new Set(rejected.map((r) => r.reason));
      for (const r of reasons) toast.error(r);
    }
    if (accepted.length > 0) setAttachments((prev) => [...prev, ...accepted]);
  }

  function removeAttachment(idx: number): void {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function openFilePicker(): void {
    fileInputRef.current?.click();
  }

  async function handleSend(text: string): Promise<void> {
    if (sending || !picked) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0 && !longSel) return;

    // 必须在所有 await 之前同步发出，保持用户手势上下文，
    // 否则 background 拿不到 user activation，chrome.sidePanel.open() 会失败。
    void sendMessage("requestOpenConversation", {
      channelId: picked.channelId,
      channelType: picked.channelType,
    }).catch(() => {});

    if (status !== ConnectStatus.Connected && status !== undefined) {
      toast.message("正在重连 IM，仍尝试发送…");
    }

    setSending(true);
    try {
      const filesToSend = [...attachments];
      if (longSel) {
        filesToSend.push(buildSelectionMarkdownFile(ctx));
      }

      const tasks: Promise<unknown>[] = filesToSend.map((f) => {
        const send = f.type.startsWith("image/")
          ? sendImage(picked.channelId, picked.channelType, f)
          : sendFile(picked.channelId, picked.channelType, f);
        return withSendAck(send);
      });

      const built = buildCmdkMessageText(trimmed, ctx, { skipQuotedBody: longSel });
      if (built.content) {
        tasks.push(
          withSendAck(sendText(picked.channelId, picked.channelType, built.content)),
        );
      }

      await Promise.all(tasks);

      void cmdkLastTargetStorage.setValue(picked);
      toast.success(`已发送到 ${picked.name}`);
      window.setTimeout(close, 200);
    } catch (err) {
      toast.error(getSendErrorMessage(err));
      setSending(false);
    }
  }

  function handleDragOver(e: React.DragEvent): void {
    e.preventDefault();
  }
  function handleDrop(e: React.DragEvent): void {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) addFiles(files);
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

        {(ctx.pageUrl || ctx.selectedText) && (
          <CmdkQuoteBlock ctx={ctx} app={app} compact={pickerOpen} />
        )}

        <CmdkAttachmentChips items={attachments} onRemove={removeAttachment} />

        <div className="shrink-0">
          <CmdkComposerSlot
            ref={composerRef}
            sending={sending}
            hasTarget={!!picked}
            hasAttachments={attachments.length > 0}
            onSubmit={(t) => void handleSend(t)}
            onPickFiles={openFilePicker}
            onPaste={addFiles}
          />
        </div>

        {pickerOpen && (
          <CmdkChannelPicker
            current={picked}
            onPick={(t) => {
              setPicked(t);
              setPickerOpen(false);
              composerRef.current?.focus();
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

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) addFiles(files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
