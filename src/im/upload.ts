import { z } from "zod";
import { api } from "@/api/client";

const CredentialsSchema = z.object({
  uploadUrl: z.string(),
  downloadUrl: z.string(),
  contentType: z.string(),
  contentDisposition: z.string().optional(),
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

export interface UploadResult {
  url: string;
  contentType: string;
}

/**
 * 客户端直传上传（COS）—— sidepanel 侧。上传完拿 downloadUrl 直接塞进消息 content 发给 offscreen。
 * 不依赖 WKSDK MessageTask，因为 offscreen 那边的 SDK 收到时 content.url 已就位。
 *
 * 与 mirror MediaMessageUploadTask 行为一致：GET credentials → PUT uploadUrl。
 *
 * onProgress: 0-100 的整数百分比
 */
export async function uploadAttachment(
  file: File,
  channelId: string,
  channelType: number,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const fileName = uuid();
  const dot = file.name.lastIndexOf(".");
  const ext = dot > 0 ? file.name.slice(dot + 1) : "";
  const path = `/${channelType}/${channelId}/${fileName}${ext ? `.${ext}` : ""}`;
  const credentials = await getUploadCredentials(file, path);
  if (!credentials) throw new Error("获取上传凭证失败");
  await putToUploadUrl(file, credentials, onProgress);
  return { url: credentials.downloadUrl, contentType: credentials.contentType };
}

async function getUploadCredentials(file: File, path: string): Promise<Credentials | null> {
  try {
    const data = await api
      .get("file/upload/credentials", {
        searchParams: {
          path,
          type: "chat",
          filename: file.name || "file",
          contentType: file.type || "application/octet-stream",
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

function putToUploadUrl(
  file: File,
  credentials: Credentials,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.total > 0 && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload failed: ${xhr.status}`)),
    );
    xhr.addEventListener("error", () => reject(new Error("upload network error")));
    xhr.addEventListener("abort", () => reject(new Error("upload aborted")));
    xhr.open("PUT", credentials.uploadUrl);
    xhr.setRequestHeader("Content-Type", credentials.contentType);
    if (credentials.contentDisposition) {
      xhr.setRequestHeader("Content-Disposition", credentials.contentDisposition);
    }
    xhr.send(file);
  });
}

export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}
