export const PREVIEW_SIZE_LIMIT = 2 * 1024 * 1024;

export interface FilePreviewParams {
  url: string;
  name: string;
  size: number;
  /** 由调用方传入的扩展名（无 . 前缀，小写）；缺失时退化为从 name 末尾解析 */
  ext: string;
}

export function parseFilePreviewParams(): FilePreviewParams {
  const sp = new URLSearchParams(window.location.search);
  const sizeRaw = sp.get("size") ?? "";
  const size = Number.parseInt(sizeRaw, 10);
  const name = sp.get("name") ?? "未命名文件";
  const ext = (sp.get("ext") ?? "").toLowerCase() || getExtensionFromName(name);
  return {
    url: sp.get("url") ?? "",
    name,
    size: Number.isFinite(size) ? Math.max(0, size) : 0,
    ext,
  };
}

const TEXT_EXTS = new Set(["md", "markdown", "txt", "log"]);
const JSON_EXTS = new Set(["json"]);
const TABLE_EXTS = new Set(["csv", "xlsx"]);

export type PreviewKind = "markdown" | "text" | "json" | "table" | "unknown";

export function getExtensionFromName(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

export function getPreviewKind(ext: string): PreviewKind {
  if (ext === "md" || ext === "markdown") return "markdown";
  if (TEXT_EXTS.has(ext)) return "text";
  if (JSON_EXTS.has(ext)) return "json";
  if (TABLE_EXTS.has(ext)) return "table";
  return "unknown";
}
