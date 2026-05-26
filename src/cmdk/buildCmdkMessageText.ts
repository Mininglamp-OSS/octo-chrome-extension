export interface PanelContext {
  selectedText: string;
  pageUrl: string;
  pageTitle: string;
  hostname: string;
}

export interface BuiltMessage {
  /** 拼装后的最终正文，可直接送 sendText 的 text */
  content: string;
}

const SOURCE_ICON = "🌐";

function quoteLines(text: string): string {
  return text
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
}

/**
 * 拼出引用块 + 用户输入的正文。
 *
 * - 默认形式：
 *     > 来自 🌐 [pageTitle](pageUrl)
 *     >
 *     > {selectedText 多行变 > 前缀}
 *
 *     {用户输入}
 * - skipQuotedBody=true（长选段已写入 .md 附件时）：仅留用户输入；来源行 + 选段全部不复述
 *   （来源已写入 .md 首行，引用消息会指向该文件，不必再重复）
 * - 缺 url 时只引用 selectedText；selectedText 也无时仅返回用户输入
 */
export function buildCmdkMessageText(
  text: string,
  ctx: PanelContext | null,
  opts?: { skipQuotedBody?: boolean },
): BuiltMessage {
  const skipBody = opts?.skipQuotedBody === true;
  const trimmed = text.trim();
  const sel = ctx?.selectedText ?? "";
  const url = ctx?.pageUrl ?? "";
  const label = ctx?.pageTitle?.trim() || url || ctx?.hostname || "";

  const blocks: string[] = [];

  if (!skipBody) {
    if (url) {
      const sourceLine = `来自 ${SOURCE_ICON} [${label}](${url})`;
      if (sel) {
        blocks.push(`> ${sourceLine}\n> \n${quoteLines(sel)}`);
      } else {
        blocks.push(`> ${sourceLine}`);
      }
    } else if (sel) {
      blocks.push(quoteLines(sel));
    }
  }

  if (trimmed) blocks.push(trimmed);

  return { content: blocks.join("\n\n") };
}
