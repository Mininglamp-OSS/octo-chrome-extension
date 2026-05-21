import { useCallback, useEffect, useRef, useState } from "react";
import { SelectionHint } from "./SelectionHint";

interface PanelContext {
  selectedText: string;
  pageUrl: string;
  pageTitle: string;
  hostname: string;
}

const READY_MSG = "CMDK_READY";
const CONTEXT_MSG = "CMDK_CONTEXT";
const DONE_MSG = "CMDK_DONE";
const PLUGIN_CALL_SOURCE = "octo-plugin-call";
const IFRAME_SIZE = { w: 380, h: 480 };

export function CmdKOverlay() {
  const [selRect, setSelRect] = useState<DOMRect | null>(null);
  const [selText, setSelText] = useState("");
  const [open, setOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingCtxRef = useRef<PanelContext | null>(null);

  const buildContext = useCallback(
    (text: string): PanelContext => ({
      selectedText: text,
      pageUrl: location.href,
      pageTitle: document.title,
      hostname: location.hostname,
    }),
    [],
  );

  const openPanel = useCallback(
    (text: string) => {
      pendingCtxRef.current = buildContext(text);
      setOpen(true);
    },
    [buildContext],
  );

  const closePanel = useCallback(() => {
    setOpen(false);
    iframeRef.current = null;
    pendingCtxRef.current = null;
  }, []);

  // 监听文字选区变化
  useEffect(() => {
    function check(): void {
      if (open) return;
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (text.length > 0 && sel?.rangeCount) {
        try {
          const r = sel.getRangeAt(0).getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            setSelRect(r);
            setSelText(text);
            return;
          }
        } catch {
          // ignore
        }
      }
      setSelRect(null);
      setSelText("");
    }
    document.addEventListener("mouseup", check);
    document.addEventListener("keyup", check);
    document.addEventListener("selectionchange", check);
    return () => {
      document.removeEventListener("mouseup", check);
      document.removeEventListener("keyup", check);
      document.removeEventListener("selectionchange", check);
    };
  }, [open]);

  // Cmd+K 快捷键
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPanel(selText);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        closePanel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel, closePanel, selText, open]);

  // 监听 main world 注入脚本 (window.pluginCall) 触发
  useEffect(() => {
    function onMsg(e: MessageEvent): void {
      const data = (e.data ?? {}) as { source?: string; cmd?: string; text?: string };
      if (data.source !== PLUGIN_CALL_SOURCE) return;
      if (data.cmd === "openCmdK") {
        openPanel(data.text ?? selText);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [openPanel, selText]);

  // iframe 与 cmdk.html 的双向通信
  useEffect(() => {
    function onMsg(e: MessageEvent): void {
      const data = (e.data ?? {}) as { type?: string };
      if (data.type === READY_MSG) {
        const ctx = pendingCtxRef.current;
        if (ctx && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: CONTEXT_MSG, payload: ctx },
            "*",
          );
        }
      } else if (data.type === DONE_MSG) {
        closePanel();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [closePanel]);

  return (
    <>
      {selRect && !open && (
        <SelectionHint rect={selRect} onClick={() => openPanel(selText)} />
      )}
      {open && (
        <div
          className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/30"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePanel();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closePanel();
          }}
          role="dialog"
          aria-modal="true"
        >
          <iframe
            ref={iframeRef}
            title="Octo Cmdk"
            src={browser.runtime.getURL("/cmdk.html")}
            style={{
              width: IFRAME_SIZE.w,
              height: IFRAME_SIZE.h,
              border: "none",
              borderRadius: 12,
              background: "var(--color-background)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            }}
            allow="clipboard-read; clipboard-write"
          />
        </div>
      )}
    </>
  );
}
