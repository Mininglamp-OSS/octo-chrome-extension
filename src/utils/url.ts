import { getApiUrl } from "@/api/url";

/**
 * 把后端返回的相对路径（如 sticker/xxx.png）拼成绝对 URL；
 * 已经是 http(s):// 的直接返回；空串返回空串。
 *
 * 对照 mirror packages/dmworkdatasource/src/datasource.ts 的 getImageURL/getFileURL
 */
export function resolveAttachmentUrl(path: string | undefined | null): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("data:") || path.startsWith("blob:")) return path;
  const base = getApiUrl();
  const baseTrim = base.endsWith("/") ? base : `${base}/`;
  const pathTrim = path.startsWith("/") ? path.slice(1) : path;
  return `${baseTrim}${pathTrim}`;
}
