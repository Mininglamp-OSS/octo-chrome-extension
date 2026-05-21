import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import type { VoiceContent } from "./VoiceMessage";

export function VoiceBubble({ data, isSelf }: { data: VoiceContent; isSelf: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const tick = () => {
      if (a.duration > 0) setProgress(a.currentTime / a.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    a.addEventListener("timeupdate", tick);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", () => setPlaying(false));
    return () => {
      a.removeEventListener("timeupdate", tick);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle(): void {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      void a.play();
      setPlaying(true);
    }
  }

  const widthCh = Math.min(20, Math.max(4, Math.round(data.timeTrad)));

  return (
    <div
      className={cn(
        "octo-msg-voice flex items-center gap-2 rounded-2xl px-3 py-2",
        isSelf
          ? "bg-(--color-foreground) text-(--color-background)"
          : "bg-(--color-muted) text-(--color-foreground)",
      )}
      style={{ minWidth: `${widthCh * 8}px` }}
    >
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isSelf
            ? "bg-(--color-background)/20 hover:bg-(--color-background)/30"
            : "bg-(--color-foreground)/15 hover:bg-(--color-foreground)/25",
        )}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "h-1 w-full overflow-hidden rounded-full",
            isSelf ? "bg-(--color-background)/20" : "bg-(--color-foreground)/15",
          )}
        >
          <div
            className={cn(
              "h-full transition-[width] duration-100",
              isSelf ? "bg-(--color-background)/70" : "bg-(--color-foreground)/70",
            )}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
      <span className="text-xs tabular-nums opacity-80">{data.timeTrad}″</span>
      {/* biome-ignore lint/a11y/useMediaCaption: 用户语音消息无字幕 */}
      <audio ref={audioRef} src={data.url} preload="none" />
    </div>
  );
}
