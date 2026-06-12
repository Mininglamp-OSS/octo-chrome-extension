import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getApiUrl } from "@/api/client";
import { useChannelInfo } from "@/api/queries/channels";
import { useSpaceMembers } from "@/api/queries/spaces";
import { isChannelInfoBot } from "@/api/schemas/channel";
import type { PanelContext } from "@/cmdk/buildCmdkMessageText";
import { CmdkChannelPicker, type PickedTarget } from "@/cmdk/CmdkChannelPicker";
import { CmdkComposer, type CmdkComposerHandle } from "@/cmdk/CmdkComposer";
import { CmdkLoggedOutNotice } from "@/cmdk/CmdkLoggedOutNotice";
import { CmdkTopBar } from "@/cmdk/CmdkTopBar";
import { isInsidePortal } from "@/cmdk/overlaySelectors";
import { useDraggable } from "@/cmdk/useDraggable";
import { ChannelType } from "@/const/channel";
import { cmdkLastTargetStorage } from "@/platform/storage";
import { selectIsLogined, useAuthStore } from "@/stores/auth";
import { currentChannelItem } from "@/stores/currentChannel";
import { useSpaceStore } from "@/stores/space";
import {
  channelAvatarUrl,
  resolveImageURL,
  resolveLogoUrl,
  resolvePersonAvatar,
  stripSpacePrefix,
} from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { isFromWindow, originFromReferrer } from "@/utils/messageGuards";

const READY_MSG = "CMDK_READY";
const CONTEXT_MSG = "CMDK_CONTEXT";
const DONE_MSG = "CMDK_DONE";
const LONG_QUOTE_THRESHOLD = 500;

/**
 * 统一向父帧（CmdKOverlay）投递消息：targetOrigin 用 document.referrer 推导的
 * 父帧 origin，杜绝通配广播。referrer 为空时不发送（cmdk iframe 恒由父页面加载，
 * 正常恒有值），绝不退化为通配。
 */
function postToParent(message: unknown): void {
  const parentOrigin = originFromReferrer(document.referrer);
  if (!parentOrigin) return;
  window.parent?.postMessage(message, parentOrigin);
}

const EMPTY_CTX: PanelContext = {
  selectedText: "",
  pageUrl: "",
  pageTitle: "",
  hostname: "",
};

const PANEL_SHADOW_REST = "0 24px 60px rgba(20, 20, 28, 0.22), 0 8px 24px rgba(20, 20, 28, 0.12)";
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
    postToParent({ type: DONE_PARENT_MSG });
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
  }, [isLogined, notifyParentClose]);

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

  // ── 默认 target 三段 fallback：侧栏当前会话 > 上次发送对象 > 空 ──
  // 复用 currentChannelItem（sidepanel 写入的会话 storage），cmdk iframe 读取并
  // 通过 useChannelInfo 拿到真名/头像后落到 picked。lastTarget 自带 name/avatar
  // 直接用即可。两者都没有 → 留空（"先选择目标"）。
  const [defaultCh, setDefaultCh] = useState<{ channelId: string; channelType: number } | null>(
    null,
  );
  const [lastTarget, setLastTarget] = useState<PickedTarget | null>(null);
  const [defaultInited, setDefaultInited] = useState(false);
  const [defaultResolved, setDefaultResolved] = useState(false);
  // 发送成功后立即隐藏面板，但保留 iframe 让右下角 toast 有时间显示。
  // 实际拆 iframe 由父帧（CmdKOverlay）收到 DONE_MSG 后延时执行。
  const [closing, setClosing] = useState(false);

  const { data: defaultInfo, isError: defaultInfoError } = useChannelInfo(
    defaultCh?.channelId ?? null,
    defaultCh?.channelType ?? 0,
  );

  useEffect(() => {
    void Promise.all([currentChannelItem.getValue(), cmdkLastTargetStorage.getValue()]).then(
      ([curr, last]) => {
        if (curr?.channelId) {
          setDefaultCh({ channelId: curr.channelId, channelType: curr.channelType });
        }
        if (last) setLastTarget(last);
        setDefaultInited(true);
      },
    );
  }, []);

  useEffect(() => {
    if (defaultResolved || !defaultInited) return;
    // 1) 侧栏当前会话：等 channelInfo 拉到才能拿到真名
    if (defaultCh) {
      if (defaultInfo) {
        const baseURL = getApiUrl();
        const name = defaultInfo.remark?.trim() || defaultInfo.name?.trim() || defaultCh.channelId;
        let avatar: string | undefined;
        if (defaultCh.channelType === ChannelType.person) {
          const logo = defaultInfo.logo?.trim() || defaultInfo.avatar?.trim();
          avatar = resolvePersonAvatar({
            baseURL,
            channelId: defaultCh.channelId,
            spaceId,
            ...(logo && { logo }),
          });
        } else {
          const logo = defaultInfo.logo?.trim() || defaultInfo.avatar?.trim();
          avatar = logo
            ? resolveLogoUrl({
                baseURL,
                channelId: defaultCh.channelId,
                channelType: defaultCh.channelType,
                logo,
              })
            : channelAvatarUrl(baseURL, defaultCh.channelId, defaultCh.channelType, spaceId);
        }
        setPicked({
          channelId: defaultCh.channelId,
          channelType: defaultCh.channelType,
          name,
          avatar,
          isBot: defaultCh.channelType === ChannelType.person && isChannelInfoBot(defaultInfo),
        });
        setDefaultResolved(true);
        return;
      }
      if (defaultInfoError) {
        // channelInfo 拉不到 → 降级到 lastTarget
        if (lastTarget) setPicked(lastTarget);
        setDefaultResolved(true);
      }
      return; // 还在 loading
    }
    // 2) 没有 currentChannel → fallback lastTarget
    if (lastTarget) setPicked(lastTarget);
    setDefaultResolved(true);
  }, [
    defaultResolved,
    defaultInited,
    defaultCh,
    defaultInfo,
    defaultInfoError,
    lastTarget,
    spaceId,
  ]);

  const longSel = ctx.selectedText.length > LONG_QUOTE_THRESHOLD;

  // 1) 接收 parent 的初始 context；2) 通知 parent 就绪
  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      // 来源校验：overlay 跑在 <all_urls>，宿主 origin 不可静态白名单，
      // 用 source 身份（必须来自父帧）+ referrer 推导 origin 双重拦截恶意兄弟 iframe。
      if (!isFromWindow(e.source, window.parent)) return;
      const parentOrigin = originFromReferrer(document.referrer);
      if (parentOrigin && e.origin !== parentOrigin) return;
      const data = (e.data ?? {}) as { type?: string; payload?: PanelContext };
      if (data.type === CONTEXT_MSG && data.payload) {
        setCtx({ ...EMPTY_CTX, ...data.payload });
      }
    }
    window.addEventListener("message", onMessage);
    postToParent({ type: READY_MSG });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function close(message?: string): void {
    if (sentRef.current) return;
    sentRef.current = true;
    if (message) {
      // duration 略短于父帧 iframe 卸载延迟（CmdKOverlay 1800ms），让 toast
      // 自然消失而不是被卸载强切。
      toast.success(message, { duration: 1600 });
    }
    setClosing(true);
    postToParent({ type: DONE_MSG });
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
  }, [pickerOpen, close]);

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

  // 已通知父帧关闭：立即收起面板与蒙层，仅靠 body 上的 Toaster 显示成功提示，
  // 父帧负责在延迟后真正卸载 iframe。
  if (closing) return null;

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
        <div className="shrink-0">
          <CmdkTopBar
            target={picked}
            onPickTarget={() => setPickerOpen((v) => !v)}
            onClose={close}
            dragHandlers={drag.handlers}
            dragging={drag.dragging}
          />
        </div>

        <div className="min-h-0 shrink-0">
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
