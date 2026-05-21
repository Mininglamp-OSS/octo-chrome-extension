import { MediaMessageContent } from "wukongimjssdk";

export const VOICE_TYPE = 4 as const;

export interface VoiceContent {
  url: string;
  /** 时长（秒，整数） */
  timeTrad: number;
  /** 可选波形数据 (base64 or compact) */
  waveform?: string;
}

export class VoiceMessage extends MediaMessageContent {
  url = "";
  timeTrad = 0;
  waveform?: string;

  override get contentType(): number {
    return VOICE_TYPE;
  }

  override decodeJSON(content: Record<string, unknown>): void {
    this.url = String(content.url ?? "");
    this.timeTrad = Number(content.timeTrad ?? 0);
    this.waveform = content.waveform ? String(content.waveform) : undefined;
    this.remoteUrl = this.url;
  }

  override encodeJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = { url: this.url, timeTrad: this.timeTrad };
    if (this.waveform) out.waveform = this.waveform;
    return out;
  }
}
