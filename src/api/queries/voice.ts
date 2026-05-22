import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "../client";
import { Endpoints } from "../endpoints";

export type VoiceMode = "smart" | "append_only" | "edit_only";

const TranscribeResultSchema = z.object({
  text: z.string(),
});
export type TranscribeResult = z.infer<typeof TranscribeResultSchema>;

export interface TranscribeReq {
  audio: Blob;
  mode?: VoiceMode;
  /** 当前 composer 文本（edit_only 模式作为指令编辑上下文） */
  contextText?: string;
  /** 最近聊天消息上下文（可选，给 ASR 衔接用） */
  chatContext?: string;
  /** 群成员名列表，提升 @mention 识别准确度 */
  memberContext?: string;
  /** 用户个人纠错串（来自 /voice/context） */
  personalContext?: string;
}

export async function transcribeVoice(req: TranscribeReq): Promise<TranscribeResult> {
  const form = new FormData();
  const ext = req.audio.type.includes("mp4") ? "mp4" : "webm";
  form.append("audio", req.audio, `recording.${ext}`);
  if (req.mode) form.append("mode", req.mode);
  if (req.contextText) form.append("context_text", req.contextText);
  if (req.chatContext) form.append("chat_context", req.chatContext);
  if (req.memberContext) form.append("member_context", req.memberContext);
  if (req.personalContext) form.append("personal_context", req.personalContext);
  const data = await api.post(Endpoints.voiceTranscribe, { body: form }).json();
  return TranscribeResultSchema.parse(data);
}

const VoiceConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true),
    max_duration: z.number().optional().default(300),
    max_file_size: z
      .number()
      .optional()
      .default(25 * 1024 * 1024),
  })
  .loose();
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  enabled: true,
  max_duration: 300,
  max_file_size: 25 * 1024 * 1024,
};

/**
 * 语音功能开关 + 限制（来自后端 /voice/config）。
 * 失败时退到默认值（开），避免后端临时挂掉就让用户用不了麦克风
 */
export function useVoiceConfig() {
  return useQuery({
    queryKey: ["voice", "config"],
    staleTime: Infinity,
    async queryFn(): Promise<VoiceConfig> {
      try {
        const data = await api.get(Endpoints.voiceConfig).json();
        return VoiceConfigSchema.parse(data);
      } catch {
        return DEFAULT_VOICE_CONFIG;
      }
    },
  });
}
