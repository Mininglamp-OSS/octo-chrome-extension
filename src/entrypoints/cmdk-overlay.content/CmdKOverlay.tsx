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

  // Cmd+K 快捷键 + Esc 兜底
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopImmediatePropagation();
        openPanel(selText);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        closePanel();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [openPanel, closePanel, selText, open]);

  // main world 注入脚本 (window.pluginCall) 触发
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

  // 与 iframe 内的 CmdkApp 双向通信
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
        <iframe
          ref={iframeRef}
          title="Octo Cmdk"
          src={browser.runtime.getURL("/cmdk.html")}
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            border: 0,
            background: "transparent",
            zIndex: 2147483646,
          }}
          allow="clipboard-read; clipboard-write"
        />
      )}
    </>
  );
}
