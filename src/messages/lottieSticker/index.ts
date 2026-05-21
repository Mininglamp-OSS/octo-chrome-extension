import { defineMessageType } from "@/messages/core/defineMessageType";
import {
  LOTTIE_STICKER_TYPE,
  type LottieStickerContent,
  LottieStickerMessage,
} from "./LottieStickerMessage";

export type { LottieStickerContent };
export { LOTTIE_STICKER_TYPE, LottieStickerMessage };

export const lottieSticker = defineMessageType({
  type: LOTTIE_STICKER_TYPE,
  name: "lottieSticker" as const,
  category: "chat",
  sdkFactory: () => new LottieStickerMessage(),
  toUI: (raw) => {
    const m = raw as LottieStickerMessage;
    return {
      url: m.url,
      category: m.category,
      placeholder: m.placeholder,
      format: m.format,
    };
  },
  fromUI: (data) => {
    const m = new LottieStickerMessage();
    m.url = data.url;
    m.category = data.category;
    m.placeholder = data.placeholder;
    m.format = data.format;
    return m;
  },
  digest: () => "[贴图]",
  copyable: "none",
  mentionable: false,
  notifiable: true,
  countsAsUnread: true,
});
