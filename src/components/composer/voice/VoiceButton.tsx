import { Mic, Send, Square, Type, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { transcribeVoice } from "@/api/queries/voice";
import { Button } from "@/components/ui/button";
import { sendVoice } from "@/im/send";
import { extractErrorMsg } from "@/utils/extractErrorMsg";
import { formatDuration, useVoiceRecorder } from "./useVoiceRecorder";

interface VoiceButtonProps {
  channelId: string;
  channelType: number;
  /** composer 当前文字（作为 ASR 上下文）*/
  contextText: string;
  /** 转写成功 → 把文本插回 composer */
  onTranscribed: (text: string) => void;
}

export function VoiceButton({
  channelId,
  channelType,
  contextText,
  onTranscribed,
}: VoiceButtonProps) {
  const recorder = useVoiceRecorder();
  const [busy, setBusy] = useState(false);

  async function start(): Promise<void> {
    if (recorder.state !== "idle" || busy) return;
    await recorder.start();
    if (recorder.error) toast.error(recorder.error);
  }

  async function stopAndTranscribe(): Promise<void> {
    setBusy(true);
    try {
      const blob = await recorder.stop();
      if (!blob) return;
      const r = await transcribeVoice({ audio: blob, contextText });
      if (r.text) onTranscribed(r.text);
      else toast.info("没有识别到语音");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "转写失败");
    } finally {
      setBusy(false);
    }
  }

  async function stopAndSend(): Promise<void> {
    setBusy(true);
    try {
      const dur = recorder.duration;
      const blob = await recorder.stop();
      if (!blob) return;
      await sendVoice(channelId, channelType, blob, dur);
    } catch (err) {
      toast.error(extractErrorMsg(err) || "发送失败");
    } finally {
      setBusy(false);
    }
  }

  if (recorder.state === "idle") {
    return (
      <button
        type="button"
        className="octo-composer-tool"
        title="语音输入"
        onClick={() => void start()}
      >
        <Mic className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-md border bg-(--color-muted) px-2 py-1">
      <span className="flex items-center gap-1 text-xs text-(--color-muted-foreground)">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        {formatDuration(recorder.duration)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => recorder.cancel()}
        disabled={busy}
        title="取消"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => void stopAndTranscribe()}
        disabled={busy}
        title="转写为文字"
      >
        {busy ? <Square className="h-3 w-3" /> : <Type className="h-3.5 w-3.5" />}
      </Button>
      <Button
        size="icon"
        className="h-7 w-7"
        onClick={() => void stopAndSend()}
        disabled={busy}
        title="发送语音消息"
      >
        <Send className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
