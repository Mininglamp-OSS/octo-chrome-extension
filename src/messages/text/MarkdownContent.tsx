import "highlight.js/styles/github.css";
import "./markdown.css";

import React, { useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

export interface MentionInfo {
  /** "@张三"（含 @ 符号） */
  name: string;
  /** uid；"all" / "channel" 视为 @所有人 */
  uid: string;
}

export interface EmojiInfo {
  /** emoji 文本 key，如 "[有品位]" */
  key: string;
  /** 图片 URL */
  url: string;
}

interface MarkdownContentProps {
  content: string;
  isSend?: boolean;
  mentions?: MentionInfo[];
  emojis?: EmojiInfo[];
}

/**
 * GitHub 默认 sanitize schema 上追加 highlight.js 需要的 class。
 * 输入是 Markdown 字符串，remark 直接解析成 AST（未开 allowDangerousHtml），
 * 所以 highlight 先跑后 sanitize 兜底安全。
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-/, /^hljs/]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className", /^hljs/]],
  },
};

const remarkPlugins = [remarkGfm, remarkBreaks];
// biome-ignore lint/suspicious/noExplicitAny: rehype plugin tuple typing varies
const rehypePlugins: any[] = [
  [rehypeHighlight, { aliases: { json5: "json" }, ignoreMissing: true }],
  [rehypeSanitize, sanitizeSchema],
];

/**
 * 独占一行的 --- / === 前后补空行，避免被解析成 setext 标题（h2/h1）；
 * fenced code block 内的内容保持原样（YAML 等不能误处理）。
 */
function normalizeContent(raw: string): string {
  const parts = raw.split(/(```[\s\S]*?```)/g);
  const processed = parts.map((part, i) => {
    if (i % 2 === 1) return part;
    return part
      .replace(/([^\n])\n([-*_]{3,})\n/g, "$1\n\n$2\n\n")
      .replace(/(^|\n)([-*_]{3,})(\n|$)/g, "\n\n$2\n\n")
      .replace(/\n{3,}/g, "\n\n");
  });
  return processed.join("").trim();
}

type Segment =
  | { type: "text"; content: string }
  | { type: "mention"; name: string; uid: string }
  | { type: "emoji"; key: string; url: string };

/** 按 mention/emoji token 切纯文本（按长度降序避免短 key 抢匹配） */
function segmentText(text: string, mentions: MentionInfo[], emojis: EmojiInfo[]): Segment[] {
  if (!mentions.length && !emojis.length) return [{ type: "text", content: text }];

  type Token =
    | { kind: "mention"; name: string; uid: string }
    | { kind: "emoji"; key: string; url: string };

  const tokens: Token[] = [
    ...mentions.map((m) => ({ kind: "mention" as const, name: m.name, uid: m.uid })),
    ...emojis.map((e) => ({ kind: "emoji" as const, key: e.key, url: e.url })),
  ].sort((a, b) => {
    const al = a.kind === "mention" ? a.name.length : a.key.length;
    const bl = b.kind === "mention" ? b.name.length : b.key.length;
    return bl - al;
  });

  const escaped = tokens.map((t) => {
    const raw = t.kind === "mention" ? t.name : t.key;
    return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  const regex = new RegExp(`(${escaped.join("|")})`, "g");

  const out: Segment[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null = regex.exec(text);
  while (m !== null) {
    if (m.index > cursor) out.push({ type: "text", content: text.slice(cursor, m.index) });
    const matched = m[0];
    const tok = tokens.find((t) => (t.kind === "mention" ? t.name === matched : t.key === matched));
    if (tok?.kind === "mention") out.push({ type: "mention", name: tok.name, uid: tok.uid });
    else if (tok?.kind === "emoji") out.push({ type: "emoji", key: tok.key, url: tok.url });
    cursor = m.index + matched.length;
    m = regex.exec(text);
  }
  if (cursor < text.length) out.push({ type: "text", content: text.slice(cursor) });
  return out;
}

/**
 * 在 ReactMarkdown 渲染结果上递归替换文本节点，把 mention / emoji 替换成自定义元素。
 * 这样不破坏表格、列表等块级 markdown 结构。
 */
function processTextChildren(
  children: React.ReactNode,
  mentions: MentionInfo[],
  emojis: EmojiInfo[],
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      const segs = segmentText(child, mentions, emojis);
      if (segs.length === 1 && segs[0]?.type === "text") return child;
      return segs.map((seg, i) => {
        if (seg.type === "mention") {
          const isAll = seg.uid === "all" || seg.uid === "channel";
          const cls = isAll ? "octo-mention octo-mention--all" : "octo-mention";
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: segment order is stable per message
            <span key={i} className={cls} data-mention-uid={seg.uid}>
              {seg.name}
            </span>
          );
        }
        if (seg.type === "emoji") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: segment order is stable per message
            <span key={i} className="octo-rich-emoji">
              <img alt={seg.key} src={seg.url} width={22} height={22} />
            </span>
          );
        }
        return seg.content;
      });
    }
    if (React.isValidElement(child)) {
      const props = child.props as { children?: React.ReactNode };
      if (props.children != null) {
        return React.cloneElement(
          child as React.ReactElement<{ children?: React.ReactNode }>,
          {},
          processTextChildren(props.children, mentions, emojis),
        );
      }
    }
    return child;
  });
}

// biome-ignore lint/suspicious/noExplicitAny: react-markdown component prop typing
const baseComponents: Record<string, any> = {
  a: ({ href, children, ...props }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  pre: ({ children, ...props }: { children?: React.ReactNode }) => (
    <div className="octo-md-pre">
      <pre {...props}>{children}</pre>
    </div>
  ),
};

export function MarkdownContent({
  content,
  isSend = false,
  mentions = [],
  emojis = [],
}: MarkdownContentProps) {
  const normalized = useMemo(() => normalizeContent(content), [content]);

  // 稳定化 mentions/emojis：父组件滚动 re-render 会传新数组实例但内容相同，
  // 不稳定下 useMemo 会失效 → ReactMarkdown 重新 unmount/remount emoji <img> → 闪烁。
  const mentionsJson = JSON.stringify(mentions);
  const stableMentions = useRef(mentions);
  const prevMentionsJson = useRef(mentionsJson);
  if (mentionsJson !== prevMentionsJson.current) {
    prevMentionsJson.current = mentionsJson;
    stableMentions.current = mentions;
  }

  const emojisJson = JSON.stringify(emojis);
  const stableEmojis = useRef(emojis);
  const prevEmojisJson = useRef(emojisJson);
  if (emojisJson !== prevEmojisJson.current) {
    prevEmojisJson.current = emojisJson;
    stableEmojis.current = emojis;
  }

  const hasTokens = stableMentions.current.length > 0 || stableEmojis.current.length > 0;

  const components = useMemo(() => {
    if (!hasTokens) return baseComponents;
    const process = (children: React.ReactNode) =>
      processTextChildren(children, stableMentions.current, stableEmojis.current);
    const wrap =
      (Tag: string) =>
      // biome-ignore lint/suspicious/noExplicitAny: react-markdown handler signature
      ({ children, ...props }: any) =>
        React.createElement(Tag, props, process(children));
    return {
      ...baseComponents,
      p: wrap("p"),
      td: wrap("td"),
      th: wrap("th"),
      li: wrap("li"),
      h1: wrap("h1"),
      h2: wrap("h2"),
      h3: wrap("h3"),
      h4: wrap("h4"),
      h5: wrap("h5"),
      h6: wrap("h6"),
    };
  }, [hasTokens]);

  return (
    <div className={`octo-md ${isSend ? "octo-md--send" : "octo-md--recv"}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
