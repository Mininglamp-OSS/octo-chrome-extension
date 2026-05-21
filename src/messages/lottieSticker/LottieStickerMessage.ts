import { MessageContent as WKMessageContent } from "wukongimjssdk";

export const LOTTIE_STICKER_TYPE = 12 as const;

export interface LottieStickerContent {
  url: string;
  category: string;
  placeholder: string;
  format: string;
}

export class LottieStickerMessage extends WKMessageContent {
  url = "";
  category = "";
  placeholder = "";
  format = "";

  override get contentType(): number {
    return LOTTIE_STICKER_TYPE;
  }

  override decodeJSON(content: Record<string, unknown>): void {
    this.url = String(content.url ?? "");
    this.category = String(content.category ?? "");
    this.placeholder = String(content.placeholder ?? "");
    this.format = String(content.format ?? "");
  }

  override encodeJSON(): Record<string, unknown> {
    return {
      url: this.url,
      category: this.category,
      placeholder: this.placeholder,
      format: this.format,
    };
  }
}
