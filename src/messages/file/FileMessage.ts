import { MediaMessageContent } from "wukongimjssdk";

export const FILE_TYPE = 8 as const;

export interface FileContent {
  name: string;
  extension: string;
  size: number;
  url: string;
  caption?: string;
  mentionUids?: string[];
}

export class FileMessage extends MediaMessageContent {
  name = "";
  override extension = "";
  size = 0;
  url = "";
  caption?: string;
  mentionUids: string[] = [];

  override get contentType(): number {
    return FILE_TYPE;
  }

  override decodeJSON(content: Record<string, unknown>): void {
    this.name = String(content.name ?? "");
    this.extension = String(content.extension ?? "");
    this.size = Number(content.size ?? 0);
    this.url = String(content.url ?? "");
    this.caption = content.caption ? String(content.caption) : undefined;
    const mentions = content.mention_uids;
    this.mentionUids = Array.isArray(mentions) ? (mentions as string[]) : [];
    this.remoteUrl = this.url;
  }

  override encodeJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = {
      name: this.name,
      extension: this.extension,
      size: this.size,
      url: this.url,
    };
    if (this.caption) out.caption = this.caption;
    if (this.mentionUids.length) out.mention_uids = this.mentionUids;
    return out;
  }
}
