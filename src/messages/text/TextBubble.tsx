import { BubbleShell } from "@/messages/core/BubbleShell";
import type { MessageRenderCtx } from "@/messages/core/defineMessageType";
import { isSingleLargeCustomEmoji, segmentCustomEmoji } from "@/utils/emoji";
import { type EmojiInfo, MarkdownContent, type MentionInfo } from "./MarkdownContent";
import type { MentionEntity, TextContent } from "./TextMessage";

/** entity 区段提取 mention 文本（含 @），供 MarkdownContent 在渲染树上回填 chip */
function collectMentionsFromEntities(text: string, entities: MentionEntity[]): MentionInfo[] {
  const out: MentionInfo[] = [];
  for (const e of entities) {
    if (e.offset < 0 || e.length <= 0 || e.offset + e.length > text.length) continue;
    if (!text.startsWith("@", e.offset)) continue;
    const name = text.slice(e.offset, e.offset + e.length);
    // 去重：同名 mention 在文本中可能多次出现，传一条就够（MarkdownContent 按 name 全文匹配）
    if (!out.find((m) => m.name === name && m.uid === e.uid)) {
      out.push({ name, uid: e.uid });
    }
  }
  return out;
}

/** 文本里出现的 @所有人/@all/@everyone 字面量都注册成 uid="all" 的 mention */
function collectMentionAllTokens(text: string): MentionInfo[] {
  const out: MentionInfo[] = [];
  const re = /@所有人|@all|@everyone/gi;
  const seen = new Set<string>();
  for (const m of text.matchAll(re)) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    out.push({ name: m[0], uid: "all" });
  }
  return out;
}

/** 旧消息（没 entities）按 @\w+ 顺序匹配 mentionUids */
function collectLegacyMentions(text: string, uids: string[]): MentionInfo[] {
  const out: MentionInfo[] = [];
  let i = 0;
  for (const m of text.matchAll(/@[\w一-龥.-]+/g)) {
    const name = m[0];
    const bare = name.slice(1);
    if (bare === "所有人" || bare.toLowerCase() === "all" || bare.toLowerCase() === "everyone") {
      continue;
    }
    if (i >= uids.length) break;
    const uid = uids[i] ?? "";
    if (!out.find((x) => x.name === name && x.uid === uid)) out.push({ name, uid });
    i += 1;
  }
  return out;
}

function buildMentions(data: TextContent): MentionInfo[] {
  const text = data.text;
  const entities = data.mentionEntities ?? [];
  const all = data.mentionAll === true ? collectMentionAllTokens(text) : [];
  if (entities.length > 0) return [...collectMentionsFromEntities(text, entities), ...all];
  if (all.length > 0) return all;
  const uids = data.mentionUids ?? [];
  if (uids.length > 0) return collectLegacyMentions(text, uids);
  return [];
}

function buildEmojis(text: string): EmojiInfo[] {
  const out: EmojiInfo[] = [];
  for (const seg of segmentCustomEmoji(text)) {
    if (seg.type !== "emoji") continue;
    if (!out.find((e) => e.key === seg.key)) out.push({ key: seg.key, url: seg.url });
  }
  return out;
}

export function TextBubble({ data, ctx }: { data: TextContent; ctx: MessageRenderCtx }) {
  const large = isSingleLargeCustomEmoji(data.text);
  const reply = data.replyInfo;
  if (large) {
    return (
      <div className="wk-msg-text-large-emoji octo-msg-large-emoji">
        {reply && <ReplyPreview reply={reply} />}
        <img src={large.url} alt={large.key} className="block h-[160px] w-[160px] object-contain" />
      </div>
    );
  }
  const mentions = buildMentions(data);
  const emojis = buildEmojis(data.text);
  return (
    <BubbleShell isSelf={ctx.isSelf}>
      {reply && <ReplyPreview reply={reply} />}
      <MarkdownContent
        content={data.text}
        isSend={ctx.isSelf}
        mentions={mentions}
        emojis={emojis}
      />
    </BubbleShell>
  );
}

function ReplyPreview({ reply }: { reply: NonNullable<TextContent["replyInfo"]> }) {
  return (
    <div className="octo-msg-reply" title={reply.digest}>
      <div className="octo-msg-reply-name">{reply.fromName || reply.fromUid}</div>
      <div className="octo-msg-reply-text">{reply.digest}</div>
    </div>
  );
}
