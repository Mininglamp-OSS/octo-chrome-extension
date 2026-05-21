import { defineMessageType } from "@/messages/core/defineMessageType";
import { VOICE_TYPE, type VoiceContent, VoiceMessage } from "./VoiceMessage";

export type { VoiceContent };
export { VOICE_TYPE, VoiceMessage };

export const voice = defineMessageType({
  type: VOICE_TYPE,
  name: "voice" as const,
  category: "chat",
  sdkFactory: () => new VoiceMessage(),
  toUI: (raw) => {
    const m = raw as VoiceMessage;
    const out: VoiceContent = { url: m.url, timeTrad: m.timeTrad };
    if (m.waveform !== undefined) out.waveform = m.waveform;
    return out;
  },
  fromUI: (data) => {
    const m = new VoiceMessage();
    m.url = data.url;
    m.timeTrad = data.timeTrad;
    if (data.waveform) m.waveform = data.waveform;
    m.remoteUrl = data.url;
    return m;
  },
  digest: () => "[语音]",
  copyable: "none",
  mentionable: false,
  notifiable: true,
  countsAsUnread: true,
});
