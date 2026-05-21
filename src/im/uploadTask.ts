import { type MediaMessageContent, MessageTask, TaskStatus } from "wukongimjssdk";
import { z } from "zod";
import { api } from "@/api/client";

const CredentialsSchema = z.object({
  uploadUrl: z.string(),
  downloadUrl: z.string(),
  contentType: z.string(),
  contentDisposition: z.string().optional(),
  key: z.string().optional(),
  expiredTime: z.number().optional(),
});
type Credentials = z.infer<typeof CredentialsSchema>;

function uuid(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const chars = "0123456789ABCDEF".split("");
  let out = "";
  for (let i = 0; i < len; i += 1) out += chars[bytes[i]! % 16];
  return out;
}

/**
 * COS 直传上传任务 —— 与 mirror MediaMessageUploadTask 行为一致：
 * 1. GET file/upload/credentials?path=&type=chat&filename=&contentType=&fileSize= 拿预签名
 * 2. PUT 文件到 uploadUrl
 * 3. 把 message.content.url / remoteUrl 写成 downloadUrl
 */
export class MediaMessageUploadTask extends MessageTask {
  private _progress = 0;
  private controller?: AbortController;

  override async start(): Promise<void> {
    const content = this.message.content as MediaMessageContent;
    if (!content.file) {
      // 已有 remoteUrl（转发场景）
      if (content.remoteUrl) {
        this.status = TaskStatus.success;
        this.update();
      } else {
        this.status = TaskStatus.fail;
        this.update();
      }
      return;
    }

    try {
      const fileName = uuid();
      const ext = content.extension ? `.${content.extension}` : "";
      const path = `/${this.message.channel.channelType}/${this.message.channel.channelID}/${fileName}${ext}`;
      const credentials = await this.getUploadCredentials(content.file, path);
      if (!credentials) {
        this.status = TaskStatus.fail;
        this.update();
        return;
      }
      await this.uploadFile(content.file, credentials);
    } catch {
      this.status = TaskStatus.fail;
      this.update();
    }
  }

  private async getUploadCredentials(file: File, path: string): Promise<Credentials | null> {
    const contentType = file.type || "application/octet-stream";
    const fileName = file.name || "file";
    try {
      const data = await api
        .get("file/upload/credentials", {
          searchParams: {
            path,
            type: "chat",
            filename: fileName,
            contentType,
            fileSize: file.size,
          },
        })
        .json();
      const parsed = CredentialsSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async uploadFile(file: File, credentials: Credentials): Promise<void> {
    const headers: Record<string, string> = { "Content-Type": credentials.contentType };
    if (credentials.contentDisposition) {
      headers["Content-Disposition"] = credentials.contentDisposition;
    }
    this.controller = new AbortController();

    const xhr = new XMLHttpRequest();
    const ok = await new Promise<boolean>((resolve) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.total > 0) {
          this._progress = Math.round((e.loaded / e.total) * 100);
          this.update();
        }
      });
      xhr.addEventListener("load", () => resolve(xhr.status >= 200 && xhr.status < 300));
      xhr.addEventListener("error", () => resolve(false));
      xhr.addEventListener("abort", () => resolve(false));
      this.controller!.signal.addEventListener("abort", () => xhr.abort());
      xhr.open("PUT", credentials.uploadUrl);
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.send(file);
    });

    if (ok) {
      const content = this.message.content as MediaMessageContent;
      content.remoteUrl = credentials.downloadUrl;
      (content as MediaMessageContent & { url?: string }).url = credentials.downloadUrl;
      this.status = TaskStatus.success;
    } else if (this.status !== TaskStatus.cancel) {
      this.status = TaskStatus.fail;
    }
    this.update();
  }

  override progress(): number {
    return this._progress;
  }

  override suspend(): void {}
  override resume(): void {}
  override cancel(): void {
    this.status = TaskStatus.cancel;
    this.controller?.abort();
    this.update();
  }
}
