export interface SelectionFileContext {
  selectedText: string;
  pageUrl: string;
  pageTitle: string;
  hostname: string;
}

const FILENAME_TITLE_LIMIT = 40;
const ILLEGAL_FILENAME_CHARS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);

/** 去掉跨平台不允许的文件名字符 + 控制字符；保留中文 / emoji / 普通空格 */
export function sanitizeForFilename(input: string): string {
  let cleaned = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x1f) continue;
    if (ILLEGAL_FILENAME_CHARS.has(ch)) continue;
    cleaned += ch;
  }
  return cleaned.replace(/\s+/g, " ").trim().slice(0, FILENAME_TITLE_LIMIT);
}

export function formatTimestamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}

/**
 * 把超长选段打包成 markdown 文件 —— 收件方点链接即跳回原页。
 * 首行写「来自 🌐 [title](url)」，与短引用消息形态一致；
 * 引用消息正文走 buildCmdkMessageText 的 skipQuotedBody=true 分支，避免重复来源。
 */
export function buildSelectionMarkdownFile(ctx: SelectionFileContext): File {
  const safe =
    sanitizeForFilename(ctx.pageTitle) ||
    sanitizeForFilename(ctx.hostname) ||
    "selection";
  const filename = `${safe}-${formatTimestamp(new Date())}.md`;

  const label = ctx.pageTitle?.trim() || ctx.pageUrl || ctx.hostname || "划词笔记";
  const sourceLine = ctx.pageUrl
    ? `来自 🌐 [${label}](${ctx.pageUrl})`
    : `来自 🌐 ${label}`;
  const lines = [sourceLine, "", "---", "", ctx.selectedText, ""];
  // 折叠重复空行
  const body = lines
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");

  return new File([body], filename, { type: "text/markdown" });
}
