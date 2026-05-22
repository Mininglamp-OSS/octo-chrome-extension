import type { Editor } from "@tiptap/react";
import { Mic } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useVoiceConfig } from "@/api/queries/voice";
import type { Member } from "@/api/schemas/member";
import { applyVoiceTranscription, type ReplaceMode } from "./applyVoiceTranscription";
import { type ChatContextResult, type UserVoiceMode, useVoiceInput } from "./useVoiceInput";

interface VoiceInputIndicatorProps {
  editor: Editor | null;
  members?: Member[];
  getCurrentText?: () => string | undefined;
  getSelectedText?: () => string | undefined;
  getSelectionRange?: () => { from: number; to: number } | undefined;
  getChatContext?: () => ChatContextResult;
  /** 浮窗定位锚点 — composer card 容器，浮窗水平居中于此 */
  anchorRef: React.RefObject<HTMLElement | null>;
}

const FLOATING_GAP = 20;
const INDICATOR_HEIGHT = 48;
const PREPARING_DELAY_MS = 300;
const RECORDING_DELAY_MS = 500;

const VOICE_MODES: { value: UserVoiceMode; label: string }[] = [
  { value: "append_only", label: "语音输入" },
  { value: "edit_only", label: "语音编辑" },
];

/** 麦克风 + 三角下拉箭头一体按钮（hover 弹菜单 / 点击直接 append_only） */
export function VoiceInputIndicator(props: VoiceInputIndicatorProps) {
  const {
    editor,
    members = [],
    getCurrentText,
    getSelectedText,
    getSelectionRange,
    getChatContext,
    anchorRef,
  } = props;

  const cfg = useVoiceConfig();
  const isVoiceEnabled = cfg.data?.enabled !== false;

  // 录音前 snapshot：选中文本 + 选区范围 + 录音模式（onTranscribed 时按它决定回填策略）
  const hadSelectionRef = useRef(false);
  const savedSelectedTextRef = useRef<string | undefined>(undefined);
  const savedSelectionRangeRef = useRef<{ from: number; to: number } | undefined>(undefined);
  const recordingModeRef = useRef<UserVoiceMode>("append_only");

  const editorRef = useRef(editor);
  editorRef.current = editor;
  const membersRef = useRef(members);
  membersRef.current = members;

  // hover 菜单状态 + 关闭防抖（portal 在 body 上，mouseleave 不冒泡，需手动 delay 让光标移到菜单上）
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const menuCloseTimerRef = useRef<number | null>(null);
  const clearMenuCloseTimer = useCallback(() => {
    if (menuCloseTimerRef.current != null) {
      clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
  }, []);
  const openMenu = useCallback(() => {
    clearMenuCloseTimer();
    if (buttonGroupRef.current) setMenuRect(buttonGroupRef.current.getBoundingClientRect());
    setShowModeMenu(true);
  }, [clearMenuCloseTimer]);
  const scheduleMenuClose = useCallback(() => {
    clearMenuCloseTimer();
    menuCloseTimerRef.current = window.setTimeout(() => setShowModeMenu(false), 120);
  }, [clearMenuCloseTimer]);
  useEffect(() => clearMenuCloseTimer, [clearMenuCloseTimer]);

  // 长按 ShiftLeft 状态
  const shiftTimerRef = useRef<number | null>(null);
  const preparingTimerRef = useRef<number | null>(null);
  const shiftRecordingRef = useRef(false);
  const cancelPendingRef = useRef(false);
  const [isPreparing, setIsPreparing] = useState(false);

  // 网络在线状态（断网禁用）
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const buttonGroupRef = useRef<HTMLDivElement>(null);

  const [floatingPosition, setFloatingPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const voice = useVoiceInput({
    enabled: isVoiceEnabled,
    maxDuration: cfg.data?.max_duration,
    maxFileSize: cfg.data?.max_file_size,
    ...(getChatContext && { getChatContext }),
    onTranscribed(text) {
      const ed = editorRef.current;
      if (!ed) return;
      const m = recordingModeRef.current;
      let replaceMode: ReplaceMode;
      if (m === "edit_only") {
        replaceMode = hadSelectionRef.current && savedSelectedTextRef.current ? "selection" : "all";
      } else {
        replaceMode = "insert";
      }
      applyVoiceTranscription({
        editor: ed,
        members: membersRef.current,
        text,
        replaceMode,
        ...(savedSelectedTextRef.current && { savedSelectedText: savedSelectedTextRef.current }),
        ...(savedSelectionRangeRef.current && {
          savedSelectionRange: savedSelectionRangeRef.current,
        }),
      });
    },
    onError(err) {
      const msg = err.message;
      if (msg.includes("denied") || msg.includes("Permission") || msg.includes("NotAllowedError")) {
        toast.error("请允许麦克风访问权限");
      } else if (msg.includes("NotFoundError") || msg.includes("NotReadableError")) {
        toast.error("麦克风不可用");
      } else if (!msg.includes("file size") && !msg.includes("Transcription failed")) {
        toast.error("语音输入失败");
      }
    },
    onRecordingFailed() {
      shiftRecordingRef.current = false;
      cancelPendingRef.current = false;
      setIsPreparing(false);
    },
  });

  const isRecording = voice.phase === "recording";
  const isTranscribing = voice.phase === "transcribing";

  const startRef = useRef(voice.start);
  startRef.current = voice.start;
  const stopRef = useRef(voice.stopAndTranscribe);
  stopRef.current = voice.stopAndTranscribe;
  const cancelRef = useRef(voice.cancel);
  cancelRef.current = voice.cancel;
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;
  const isTranscribingRef = useRef(isTranscribing);
  isTranscribingRef.current = isTranscribing;

  const clearShiftTimers = useCallback(() => {
    if (shiftTimerRef.current != null) {
      clearTimeout(shiftTimerRef.current);
      shiftTimerRef.current = null;
    }
    if (preparingTimerRef.current != null) {
      clearTimeout(preparingTimerRef.current);
      preparingTimerRef.current = null;
    }
    setIsPreparing(false);
  }, []);

  // recording 已起 + 标记 cancelPending → 立刻取消
  useEffect(() => {
    if (isRecording && cancelPendingRef.current) {
      cancelPendingRef.current = false;
      shiftRecordingRef.current = false;
      setIsPreparing(false);
      cancelRef.current();
      return;
    }
    if (isRecording) setIsPreparing(false);
  }, [isRecording]);

  // 浮窗定位：anchor card 中心，top - gap - height；resize / scroll 时 raf 重算
  const updateFloatingPosition = useCallback(() => {
    const card = anchorRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    setFloatingPosition({
      top: rect.top - FLOATING_GAP - INDICATOR_HEIGHT,
      left: rect.left + rect.width / 2,
    });
  }, [anchorRef]);

  useEffect(() => {
    if (!isRecording && !isTranscribing) {
      setFloatingPosition(null);
      return;
    }
    updateFloatingPosition();
    const onResize = () => updateFloatingPosition();
    let raf: number | null = null;
    const onScroll = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        updateFloatingPosition();
        raf = null;
      });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [isRecording, isTranscribing, updateFloatingPosition]);

  // 菜单显示时跟随 button group rect（resize/scroll 重算）。必须在 early return 之前
  useEffect(() => {
    if (!showModeMenu) {
      setMenuRect(null);
      return;
    }
    const recalc = () => {
      if (buttonGroupRef.current) setMenuRect(buttonGroupRef.current.getBoundingClientRect());
    };
    recalc();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [showModeMenu]);

  // 小工具：起录前抓现场（选区/全文/模式）
  const captureBeforeStart = useCallback(
    (mode: UserVoiceMode) => {
      const sel = getSelectedText?.();
      const range = getSelectionRange?.();
      hadSelectionRef.current = Boolean(sel);
      savedSelectedTextRef.current = sel;
      savedSelectionRangeRef.current = range;
      recordingModeRef.current = mode;
    },
    [getSelectedText, getSelectionRange],
  );

  // 全局快捷键：Esc / Shift+Cmd/Ctrl+Space / 长按 ShiftLeft
  useEffect(() => {
    if (!isVoiceEnabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape" && isRecordingRef.current) {
        e.preventDefault();
        cancelRef.current();
        return;
      }
      // Shift+Cmd/Ctrl+Space → append_only
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && e.code === "Space") {
        if (!isRecordingRef.current && !isTranscribingRef.current) {
          e.preventDefault();
          if (!isOnlineRef.current) {
            toast.warning("网络不可用，无法使用语音功能");
            return;
          }
          captureBeforeStart("append_only");
          void startRef.current("append_only");
        }
        return;
      }
      // 长按 ShiftLeft（不含其他修饰）→ 300ms preparing → 500ms 起录
      if (e.code === "ShiftLeft" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (
          !isRecordingRef.current &&
          !isTranscribingRef.current &&
          shiftTimerRef.current == null
        ) {
          cancelPendingRef.current = false;
          preparingTimerRef.current = window.setTimeout(() => {
            preparingTimerRef.current = null;
            setIsPreparing(true);
          }, PREPARING_DELAY_MS);
          shiftTimerRef.current = window.setTimeout(() => {
            shiftTimerRef.current = null;
            if (!isOnlineRef.current) {
              toast.warning("网络不可用，无法使用语音功能");
              setIsPreparing(false);
              return;
            }
            shiftRecordingRef.current = true;
            captureBeforeStart("append_only");
            void startRef.current("append_only");
          }, RECORDING_DELAY_MS);
        }
        return;
      }
      // pending 期间按其他键 → 取决于类型
      if (shiftTimerRef.current != null && e.code !== "ShiftLeft") {
        if (e.code.startsWith("Control") || e.code.startsWith("Alt") || e.code.startsWith("Meta")) {
          clearShiftTimers();
          return;
        }
        const isIME =
          e.code.startsWith("Shift") ||
          e.key === "Process" ||
          e.key === "Unidentified" ||
          e.isComposing;
        if (!isIME) clearShiftTimers();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // ShiftLeft 在 timer 还 pending 时松开（普通敲 Shift）→ 取消
      if (e.code === "ShiftLeft" && shiftTimerRef.current != null) {
        clearShiftTimers();
        return;
      }
      // ShiftLeft 在 getUserMedia 期间松开（recording 还没 true）→ 标记 cancelPending
      if (e.code === "ShiftLeft" && shiftRecordingRef.current && !isRecordingRef.current) {
        cancelPendingRef.current = true;
        shiftRecordingRef.current = false;
        return;
      }
      // 长按起录后松开 ShiftLeft → 停止 + 转写
      if (e.code === "ShiftLeft" && shiftRecordingRef.current && isRecordingRef.current) {
        shiftRecordingRef.current = false;
        e.preventDefault();
        const ctxText = recordingModeRef.current === "edit_only" ? getCurrentText?.() : undefined;
        void stopRef.current(ctxText);
        return;
      }
      if (!isRecordingRef.current) return;
      // Shift+Cmd+Space 流程：松开任意修饰键 → 停止 + 转写
      if (e.key === "Shift" || e.key === "Meta" || e.key === "Control") {
        if (shiftRecordingRef.current) return;
        e.preventDefault();
        const ctxText = recordingModeRef.current === "edit_only" ? getCurrentText?.() : undefined;
        void stopRef.current(ctxText);
      }
    };

    const onBlur = () => clearShiftTimers();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      clearShiftTimers();
    };
  }, [isVoiceEnabled, captureBeforeStart, getCurrentText, clearShiftTimers]);

  // recording 时窗口失焦 → 自动停 + 转写
  useEffect(() => {
    if (!isRecording) return;
    const onBlur = () => {
      const ctxText = recordingModeRef.current === "edit_only" ? getCurrentText?.() : undefined;
      void stopRef.current(ctxText);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [isRecording, getCurrentText]);

  if (!isVoiceEnabled) return null;

  // ===== 行为 handlers =====
  const handleModeSelect = (mode: UserVoiceMode) => {
    clearMenuCloseTimer();
    setShowModeMenu(false);
    if (!isOnline) return;
    captureBeforeStart(mode);
    void voice.start(mode);
  };

  const handleVoiceClick = () => {
    clearMenuCloseTimer();
    setShowModeMenu(false);
    if (!isOnline) {
      toast.warning("网络不可用，无法使用语音功能");
      return;
    }
    captureBeforeStart("append_only");
    void voice.start("append_only");
  };

  const handleStopClick = () => {
    let ctxText: string | undefined;
    if (recordingModeRef.current === "edit_only") {
      ctxText = getSelectedText?.() || getCurrentText?.();
    }
    void voice.stopAndTranscribe(ctxText);
  };

  // ===== 渲染：transcribing > recording > preparing > idle =====
  const arrowSvg = (extraClass = "") => (
    <svg
      width="6"
      height="4"
      viewBox="0 0 6 4"
      fill="currentColor"
      className={`octo-voice-arrow${extraClass}`}
      aria-hidden="true"
    >
      <path d="M0.5 0.5L3 3.5L5.5 0.5H0.5Z" />
    </svg>
  );

  if (isTranscribing) {
    const statusText = recordingModeRef.current === "edit_only" ? "编辑中" : "转写中";
    const indicator = floatingPosition && (
      <div
        className="octo-voice-floating-indicator"
        style={{
          top: floatingPosition.top,
          left: floatingPosition.left,
          transform: "translateX(-50%)",
        }}
      >
        <div className="octo-voice-floating-content">
          <span className="octo-voice-floating-text">{statusText}</span>
        </div>
        <span className="octo-voice-floating-divider" />
        <div className="octo-voice-transcribing-spinner" role="status" aria-label={statusText} />
      </div>
    );
    return (
      <>
        {indicator && createPortal(indicator, document.body)}
        <div className="octo-voice-button-group" ref={buttonGroupRef}>
          <div
            className="octo-voice-button octo-voice-button--recording"
            title={`${statusText}...`}
          >
            <Mic size={18} color="currentColor" />
            {arrowSvg()}
          </div>
        </div>
      </>
    );
  }

  if (isRecording) {
    const modeLabel = recordingModeRef.current === "edit_only" ? "语音编辑" : "语音输入";
    const indicator = floatingPosition && (
      <div
        className="octo-voice-floating-indicator"
        style={{
          top: floatingPosition.top,
          left: floatingPosition.left,
          transform: "translateX(-50%)",
        }}
      >
        <div className="octo-voice-floating-content">
          <span className="octo-voice-floating-text">{modeLabel}</span>
        </div>
        <span className="octo-voice-floating-divider" />
        <div className="octo-voice-wave-container" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 固定 16 条
            <span key={i} className="octo-voice-wave-bar" />
          ))}
        </div>
      </div>
    );
    return (
      <>
        {indicator && createPortal(indicator, document.body)}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: 整个 group 作为「停止」交互区，内部 mic 视觉就是按钮 */}
        <div
          className="octo-voice-button-group"
          ref={buttonGroupRef}
          onClick={handleStopClick}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              handleStopClick();
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <div className="octo-voice-button octo-voice-button--recording" title="点击停止录音">
            <Mic size={18} color="currentColor" />
            {arrowSvg()}
          </div>
        </div>
      </>
    );
  }

  if (isPreparing) {
    return (
      <div className="octo-voice-button-group" ref={buttonGroupRef}>
        <div className="octo-voice-button octo-voice-button--preparing" title="准备中...">
          <Mic size={18} color="currentColor" />
          {arrowSvg()}
        </div>
      </div>
    );
  }

  // idle
  const isActive = showModeMenu && isOnline;
  const menuPortal =
    isActive && menuRect
      ? createPortal(
          <div
            className="octo-voice-menu octo-voice-menu--portal"
            role="menu"
            style={{
              position: "fixed",
              // 菜单左边对齐 mic 左边（往右展开，避免覆盖聊天区）；再夹紧右边界
              left: Math.max(8, Math.min(menuRect.left, window.innerWidth - 160 - 8)),
              bottom: Math.max(8, window.innerHeight - menuRect.top + 4),
            }}
            onMouseEnter={openMenu}
            onMouseLeave={scheduleMenuClose}
          >
            {VOICE_MODES.map((m) => (
              <button
                type="button"
                key={m.value}
                className="octo-voice-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  handleModeSelect(m.value);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover 触发菜单 + click 起录，焦点在内部 button
    <div
      className={`octo-voice-button-group${isActive ? " octo-voice-button-group--active" : ""}`}
      ref={buttonGroupRef}
      onMouseEnter={() => {
        if (isOnline) openMenu();
      }}
      onMouseLeave={scheduleMenuClose}
      onClick={handleVoiceClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          handleVoiceClick();
        }
      }}
      style={{ cursor: isOnline ? "pointer" : "not-allowed" }}
    >
      <div
        className={`octo-voice-button${
          !isOnline ? " octo-voice-button--disabled" : isActive ? " octo-voice-button--active" : ""
        }`}
        title={isOnline ? "语音输入 (长按 Shift)" : "网络不可用"}
      >
        <Mic size={18} color="currentColor" />
        {arrowSvg(isActive ? " octo-voice-arrow--up" : "")}
      </div>
      {menuPortal}
    </div>
  );
}
