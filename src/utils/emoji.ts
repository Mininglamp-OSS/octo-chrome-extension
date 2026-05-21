/**
 * 自定义表情包文本标记 → 内置 PNG 资源。
 * 对照 mirror packages/dmworkbase/src/Service/EmojiService.ts emojiMap
 *
 * 资源放在 public/emoji/ 下，构建后位于扩展根 /emoji/xxx.png
 */
export interface CustomEmojiDef {
  /** 文本标记，例：[使命必达] —— 既是渲染时识别用的 key，也是发送时塞进文本的内容 */
  key: string;
  /** PNG 文件名（不含扩展名），位于 public/emoji/ */
  file: string;
  /** 简短 id，emoji-mart picker 用 */
  id: string;
  /** 显示名（picker tooltip / 搜索词） */
  name: string;
}

export const CUSTOM_EMOJIS: readonly CustomEmojiDef[] = [
  { key: "[使命必达]", file: "custom_mission", id: "mission", name: "使命必达" },
  { key: "[崇尚行动]", file: "custom_action", id: "action", name: "崇尚行动" },
  { key: "[有品位]", file: "custom_taste", id: "taste", name: "有品位" },
];

const CUSTOM_EMOJI_BY_KEY: Readonly<Record<string, CustomEmojiDef>> = Object.fromEntries(
  CUSTOM_EMOJIS.map((e) => [e.key, e]),
);
const CUSTOM_EMOJI_BY_ID: Readonly<Record<string, CustomEmojiDef>> = Object.fromEntries(
  CUSTOM_EMOJIS.map((e) => [e.id, e]),
);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CUSTOM_EMOJI_REGEX = new RegExp(
  `(${CUSTOM_EMOJIS.map((e) => escapeRegExp(e.key)).join("|")})`,
  "g",
);

/** chrome.runtime.getURL 取扩展内绝对 URL；非扩展上下文回退到根相对路径 */
export function getCustomEmojiUrl(key: string): string {
  const def = CUSTOM_EMOJI_BY_KEY[key];
  if (!def) return "";
  const rel = `emoji/${def.file}.png`;
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(rel);
    }
  } catch {
    // sidepanel 之外的环境（测试等）
  }
  return `/${rel}`;
}

/** picker 回调里给出 id 时，反查文本标记 [xxx] */
export function getCustomEmojiKeyById(id: string): string | undefined {
  return CUSTOM_EMOJI_BY_ID[id]?.key;
}

export type EmojiSegment =
  | { type: "text"; text: string }
  | { type: "emoji"; key: string; url: string };

/** 把文本按自定义 emoji 标记切片，方便 inline 渲染 */
export function segmentCustomEmoji(text: string): EmojiSegment[] {
  if (!text) return [];
  const out: EmojiSegment[] = [];
  let last = 0;
  // matchAll 需要 g flag —— CUSTOM_EMOJI_REGEX 已带
  for (const m of text.matchAll(CUSTOM_EMOJI_REGEX)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: "text", text: text.slice(last, idx) });
    const key = m[0];
    out.push({ type: "emoji", key, url: getCustomEmojiUrl(key) });
    last = idx + key.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** 整条消息恰好是一个自定义 emoji（trim 后），返回 url；否则 null。命中即大表情渲染 */
export function isSingleLargeCustomEmoji(text: string): { key: string; url: string } | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed || !CUSTOM_EMOJI_BY_KEY[trimmed]) return null;
  return { key: trimmed, url: getCustomEmojiUrl(trimmed) };
}

