import { MediaMessageContent } from "wukongimjssdk";

export const IMAGE_TYPE = 2 as const;

export interface ImageContent {
  url: string;
  width: number;
  height: number;
  caption?: string;
  mentionUids?: string[];
  name?: string;
}

export class ImageMessage extends MediaMessageContent {
  width = 0;
  height = 0;
  url = "";
  caption?: string;
  mentionUids: string[] = [];
  name?: string;

  override get contentType(): number {
    return IMAGE_TYPE;
  }

  override decodeJSON(content: Record<string, unknown>): void {
    this.width = Number(content.width ?? 0);
    this.height = Number(content.height ?? 0);
    this.url = String(content.url ?? "");
    this.caption = content.caption ? String(content.caption) : undefined;
    const mentions = content.mention_uids;
    this.mentionUids = Array.isArray(mentions) ? (mentions as string[]) : [];
    this.name = content.name ? String(content.name) : undefined;
    this.remoteUrl = this.url;
  }

  override encodeJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = {
      width: this.width,
      height: this.height,
      url: this.url,
    };
    if (this.caption) out.caption = this.caption;
    if (this.mentionUids.length) out.mention_uids = this.mentionUids;
    if (this.name) out.name = this.name;
    return out;
  }
}
