import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { transcribeVoice, type VoiceMode } from "@/api/queries/voice";
import { useSpaceStore } from "@/stores/space";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { clearVoiceContextCache, getVoiceContext, type VoiceContext } from "./voiceContextCache";

/** UI 上只暴露这两种；mirror 的 smart 不外露 */
export type UserVoiceMode = Extract<VoiceMode, "append_only" | "edit_only">;

export type VoicePhase = "idle" | "recording" | "transcribing";

export interface ChatContextResult {
  memberContext?: string;
  chatContext?: string;
}

export interface UseVoiceInputOpts {
  /** 来自 useVoiceConfig；false 时 hook 全程 no-op */
  enabled: boolean;
  maxDuration?: number;
  maxFileSize?: number;
  getChatContext?: () => ChatContextResult;
  onTranscribed: (text: string) => void;
  /** getUserMedia / 转写 / 文件超限等失败 → 调用方决定 toast */
  onError?: (err: Error) => void;
  /** getUserMedia 失败时，让 UI 清掉 preparing 等中间态 */
  onRecordingFailed?: () => void;
}

const DEFAULT_MAX_DURATION_S = 300;
const MIN_DURATION_MS = 1000;

export interface VoiceInputApi {
  phase: VoicePhase;
  mode: UserVoiceMode | null;
  start: (mode: UserVoiceMode) => Promise<void>;
  stopAndTranscribe: (contextText?: string) => Promise<void>;
  cancel: () => void;
}

/**
 * 录音状态机（对齐 mirror useVoiceInput）：
 * - start 时 fire-and-forget 拉 /voice/context；stopAndTranscribe 时 await 它
 * - stopAndTranscribe 接收 contextText（edit_only 时由调用方传选区/全文）
 * - chat/member_context 由 getChatContext() 在 stop 时取
 * - <1s warning「未检测到语音」、超限 error「录音文件过大」、转写失败 error「转写失败，请重试」
 * - useSpaceStore.subscribe 检测 currentSpaceId 切换 → 清 voice/context 缓存
 * - getUserMedia / 文件超限 / 转写失败 → 同时回调 onError（让 UI 处理麦克风权限等具体文案）
 */
export function useVoiceInput(opts: UseVoiceInputOpts): VoiceInputApi {
  const recorder = useVoiceRecorder();
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [mode, setMode] = useState<UserVoiceMode | null>(null);

  const maxDurationS = opts.maxDuration ?? DEFAULT_MAX_DURATION_S;
  const maxFileSize = opts.maxFileSize ?? 0;

  const phaseRef = useRef<VoicePhase>("idle");
  phaseRef.current = phase;
  const modeRef = useRef<UserVoiceMode | null>(null);
  modeRef.current = mode;
  const enabledRef = useRef(opts.enabled);
  enabledRef.current = opts.enabled;
  const getChatContextRef = useRef(opts.getChatContext);
  getChatContextRef.current = opts.getChatContext;
  const onTranscribedRef = useRef(opts.onTranscribed);
  onTranscribedRef.current = opts.onTranscribed;
  const onErrorRef = useRef(opts.onError);
  onErrorRef.current = opts.onError;
  const onRecordingFailedRef = useRef(opts.onRecordingFailed);
  onRecordingFailedRef.current = opts.onRecordingFailed;

  const maxTimerRef = useRef<number | null>(null);
  const vcResultRef = useRef<VoiceContext | null>(null);
  const vcPromiseRef = useRef<Promise<VoiceContext | null> | null>(null);
  const vcSpaceIdRef = useRef<string>("");
  const contextTextRef = useRef<string>("");
  const stopFnRef = useRef<(t?: string) => Promise<void>>(async () => {});

  const clearMaxTimer = useCallback(() => {
    if (maxTimerRef.current != null) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const resetVoiceCtxState = useCallback(() => {
    vcResultRef.current = null;
    vcPromiseRef.current = null;
    vcSpaceIdRef.current = "";
  }, []);

  // space 切换 → 清缓存 + 清本次 ref（对齐 mirror WKApp.mittBus space-changed）
  useEffect(() => {
    let last = useSpaceStore.getState().currentSpaceId;
    const unsub = useSpaceStore.subscribe((state) => {
      const cur = state.currentSpaceId;
      if (cur === last) return;
      if (last) clearVoiceContextCache(last);
      resetVoiceCtxState();
      last = cur;
    });
    return unsub;
  }, [resetVoiceCtxState]);

  const cancel = useCallback(() => {
    clearMaxTimer();
    recorder.cancel();
    resetVoiceCtxState();
    contextTextRef.current = "";
    setMode(null);
    setPhase("idle");
  }, [clearMaxTimer, recorder, resetVoiceCtxState]);

  const stopAndTranscribe = useCallback(
    async (contextText?: string) => {
      if (phaseRef.current !== "recording") return;
      if (typeof contextText === "string") contextTextRef.current = contextText;
      clearMaxTimer();

      const curMode = modeRef.current;
      if (!curMode) {
        cancel();
        return;
      }

      const recordedSec = recorder.duration;
      setPhase("transcribing");
      const blob = await recorder.stop();
      const cleanupLocal = () => {
        contextTextRef.current = "";
        resetVoiceCtxState();
        setPhase("idle");
        setMode(null);
      };
      if (!blob) {
        toast.warning("未检测到语音");
        cleanupLocal();
        return;
      }
      if (recordedSec * 1000 < MIN_DURATION_MS) {
        toast.warning("未检测到语音");
        cleanupLocal();
        return;
      }
      if (maxFileSize > 0 && blob.size > maxFileSize) {
        toast.error("录音文件过大");
        onErrorRef.current?.(new Error("Recording file size exceeds limit"));
        cleanupLocal();
        return;
      }

      // 等 voice/context（预拉的 promise 通常已 settle，几乎零等待）
      try {
        if (vcPromiseRef.current) await vcPromiseRef.current;
      } catch {
        // ignore
      }
      const vc = vcResultRef.current;
      const personalContext = vc?.has_context && vc?.context ? vc.context : "";
      const { memberContext = "", chatContext = "" } = getChatContextRef.current?.() ?? {};
      const ctxText = contextTextRef.current;

      try {
        const resp = await transcribeVoice({
          audio: blob,
          mode: curMode,
          ...(ctxText && { contextText: ctxText }),
          ...(chatContext && { chatContext }),
          ...(memberContext && { memberContext }),
          ...(personalContext && { personalContext }),
        });
        if (resp.text) {
          onTranscribedRef.current(resp.text);
        }
      } catch {
        toast.error("转写失败，请重试");
        // 与 mirror 一致：用 "Transcription failed" 让组件 onError 能过滤掉避免双 toast
        onErrorRef.current?.(new Error("Transcription failed"));
      } finally {
        cleanupLocal();
      }
    },
    [cancel, clearMaxTimer, maxFileSize, recorder, resetVoiceCtxState],
  );

  // 让 max_duration 定时器闭包能拿到最新 stop 函数
  stopFnRef.current = stopAndTranscribe;

  const start = useCallback(
    async (m: UserVoiceMode) => {
      if (!enabledRef.current) return;
      if (phaseRef.current !== "idle") return;

      // 预拉 voice/context（fire-and-forget）
      const spaceId = useSpaceStore.getState().currentSpaceId ?? "";
      vcResultRef.current = null;
      vcSpaceIdRef.current = spaceId;
      if (spaceId) {
        const my = spaceId;
        vcPromiseRef.current = getVoiceContext(spaceId)
          .then((resp) => {
            if (vcSpaceIdRef.current === my) vcResultRef.current = resp;
            return resp;
          })
          .catch(() => null);
      } else {
        vcPromiseRef.current = null;
      }

      setMode(m);
      await recorder.start();
      if (recorder.error) {
        const msg = recorder.error;
        onErrorRef.current?.(new Error(msg || "Microphone access denied"));
        onRecordingFailedRef.current?.();
        resetVoiceCtxState();
        setMode(null);
        return;
      }
      setPhase("recording");
      maxTimerRef.current = window.setTimeout(() => {
        void stopFnRef.current();
      }, maxDurationS * 1000);
    },
    [maxDurationS, recorder, resetVoiceCtxState],
  );

  useEffect(
    () => () => {
      clearMaxTimer();
    },
    [clearMaxTimer],
  );

  return { phase, mode, start, stopAndTranscribe, cancel };
}
