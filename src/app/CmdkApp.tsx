import { Search, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { ConversationSyncResponseSchema } from "@/api/schemas/conversation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConversationView } from "@/im/conversation";
import { toConversationView } from "@/im/conversation";
import { useImConnectionStatus } from "@/im/hooks/useImConnectionStatus";
import { ConnectStatus } from "@/im/proxy";
import { sendText } from "@/im/send";
import { avatarGradient, getFirstChar } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

interface PanelContext {
  selectedText: string;
  pageUrl: string;
  pageTitle: string;
  hostname: string;
}

const READY_MSG = "CMDK_READY";
const CONTEXT_MSG = "CMDK_CONTEXT";
const DONE_MSG = "CMDK_DONE";

export function CmdkApp() {
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [keyword, setKeyword] = useState("");
  const [picked, setPicked] = useState<ConversationView | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const status = useImConnectionStatus();
  const sentRef = useRef(false);

  // 拉会话 —— cmdk overlay 是独立 webview，自己直接 HTTP；X-Space-Id 由 ky 自动注入
  useEffect(() => {
    let cancelled = false;
    void api
      .post(Endpoints.conversations, { json: { msg_count: 1 } })
      .json()
      .then((data) => {
        if (cancelled) return;
        const parsed = ConversationSyncResponseSchema.parse(data);
        setConversations((parsed.conversations ?? []).map(toConversationView));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // 接收来自 parent (cmdk-overlay) 的初始 context
  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      const data = (e.data ?? {}) as { type?: string; payload?: PanelContext };
      if (data.type === CONTEXT_MSG && data.payload) {
        setText(data.payload.selectedText ?? "");
      }
    }
    window.addEventListener("message", onMessage);
    // 通知 parent 我已就绪
    window.parent?.postMessage({ type: READY_MSG }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return conversations.slice(0, 50);
    return conversations.filter((c) => c.name.toLowerCase().includes(k)).slice(0, 50);
  }, [conversations, keyword]);

  function close(): void {
    if (!sentRef.current) {
      window.parent?.postMessage({ type: DONE_MSG }, "*");
      sentRef.current = true;
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function send(): Promise<void> {
    if (!picked || !text.trim() || sending) return;
    setSending(true);
    try {
      await sendText(picked.channelId, picked.channelType, text.trim());
      toast.success(`已发送到 ${picked.name}`);
      setTimeout(close, 200);
    } catch (err) {
      toast.error(extractErrorMsg(err) || "发送失败");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-(--color-background)">
      <header className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">发送到 Octo</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={close}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      {!picked ? (
        <>
          <div className="border-b px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--color-muted-foreground)" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索会话…"
                className="pl-7"
                autoFocus
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-4 text-center text-xs text-(--color-muted-foreground)">
                {status === ConnectStatus.Connected ? "无匹配会话" : "未连接"}
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.channelId}
                type="button"
                onClick={() => setPicked(c)}
                className="flex w-full items-center gap-2 border-b px-3 py-2 text-left hover:bg-(--color-accent)/40"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  {c.avatar && <AvatarImage src={c.avatar} alt={c.name} />}
                  <AvatarFallback
                    className="text-[10px] text-white"
                    style={{ background: avatarGradient(c.name) }}
                  >
                    {getFirstChar(c.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">{c.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-xs text-(--color-muted-foreground) hover:underline"
            >
              ← 重选
            </button>
            <span className={cn("ml-auto truncate text-xs font-medium")}>{picked.name}</span>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="想说点什么…"
              className="h-full w-full resize-none rounded-md border bg-transparent p-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-ring)"
              ref={(el) => {
                el?.focus();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t px-3 py-2">
            <span className="text-[10px] text-(--color-muted-foreground)">⌘+Enter 发送</span>
            <Button size="sm" onClick={() => void send()} disabled={sending || !text.trim()}>
              <Send className="mr-1 h-3 w-3" />
              发送
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
