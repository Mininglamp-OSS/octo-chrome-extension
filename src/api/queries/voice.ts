import { z } from "zod";
import { api } from "../client";
import { Endpoints } from "../endpoints";

const TranscribeResultSchema = z.object({
  text: z.string(),
});
export type TranscribeResult = z.infer<typeof TranscribeResultSchema>;

export interface TranscribeReq {
  audio: Blob;
  /** 已有上下文文本（如 composer 现有内容），帮助 ASR 衔接 */
  contextText?: string;
}

export async function transcribeVoice(req: TranscribeReq): Promise<TranscribeResult> {
  const form = new FormData();
  const ext = req.audio.type.includes("mp4") ? "mp4" : "webm";
  form.append("audio", req.audio, `recording.${ext}`);
  if (req.contextText) form.append("context_text", req.contextText);
  const data = await api.post(Endpoints.voiceTranscribe, { body: form }).json();
  return TranscribeResultSchema.parse(data);
}
