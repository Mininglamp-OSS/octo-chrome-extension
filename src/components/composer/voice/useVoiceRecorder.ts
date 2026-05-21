import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "stopping";

export interface RecorderApi {
  state: RecorderState;
  duration: number;
  /** 开始录音，需用户授权 microphone */
  start: () => Promise<void>;
  /** 停止并返回最终 Blob */
  stop: () => Promise<Blob | null>;
  /** 取消（不返回数据） */
  cancel: () => void;
  error: string | null;
}

const MIME_PREFER = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType(): string | undefined {
  for (const t of MIME_PREFER) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export function useVoiceRecorder(): RecorderApi {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
    }
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(100);
      recorderRef.current = mr;
      startedAtRef.current = Date.now();
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((Date.now() - startedAtRef.current) / 1000);
      }, 100) as unknown as number;
      setState("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法访问麦克风");
      setState("idle");
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const mr = recorderRef.current;
    if (!mr) return null;
    setState("stopping");
    return new Promise<Blob | null>((resolve) => {
      mr.onstop = () => {
        const type = mr.mimeType || "audio/webm";
        const blob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type }) : null;
        cleanup();
        setState("idle");
        resolve(blob);
      };
      try {
        mr.stop();
      } catch {
        cleanup();
        setState("idle");
        resolve(null);
      }
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    const mr = recorderRef.current;
    if (mr) {
      mr.onstop = null;
      try {
        mr.stop();
      } catch {
        // ignore
      }
    }
    chunksRef.current = [];
    cleanup();
    setState("idle");
  }, [cleanup]);

  return { state, duration, start, stop, cancel, error };
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
