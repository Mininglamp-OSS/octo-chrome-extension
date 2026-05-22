/**
 * 把转写返回的纯文本里 `@张三 / @所有人` 字面量识别为 mention 节点。
 * 行为对齐 mirror voiceMentionParser：
 * - 三个特殊名 所有人 / all / everyone（不区分大小写） → uid="-1" label="所有人"
 * - 名字按长度倒序去重，避免「张三」抢「张三丰」
 * - regex 带后置 lookahead `(?=[\s，。！？,!?]|$)`，避免 "@王五XYZ" 误命中
 * - mention 节点后自动补 " "（吃掉紧随的单个空格或在 EOS 时新增）
 */

export interface MemberInfo {
  uid: string;
  name: string;
}

export interface MentionAttrs {
  id: string;
  label: string;
}

export type ParsedSegment =
  | { type: "text"; text: string }
  | { type: "mention"; attrs: MentionAttrs };

const SPECIAL_NAMES = ["所有人", "all", "everyone"] as const;
const SPECIAL_UID = "-1";

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildMentionRegex(members: MemberInfo[]): RegExp {
  const all = [...SPECIAL_NAMES, ...members.map((m) => m.name)];
  const unique = [...new Set(all)].filter((n) => n.length > 0);
  unique.sort((a, b) => b.length - a.length);
  const pattern = unique.map(escapeRegExp).join("|");
  return new RegExp(`@(${pattern})(?=[\\s，。！？,!?]|$)`, "gi");
}

function isSpecialName(name: string): boolean {
  const lower = name.toLowerCase();
  return SPECIAL_NAMES.some((s) => s.toLowerCase() === lower);
}

export function parseMentionMarkers(text: string, members: MemberInfo[]): ParsedSegment[] {
  if (!text) return [];
  const out: ParsedSegment[] = [];
  const regex = buildMentionRegex(members);
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match !== null) {
    const name = match[1] ?? "";
    const start = match.index;
    if (start > lastIndex) {
      out.push({ type: "text", text: text.slice(lastIndex, start) });
    }
    const special = isSpecialName(name);
    const member = special
      ? null
      : members.find((m) => m.name.toLowerCase() === name.toLowerCase());
    if (special) {
      out.push({ type: "mention", attrs: { id: SPECIAL_UID, label: "所有人" } });
    } else if (member) {
      out.push({ type: "mention", attrs: { id: member.uid, label: member.name } });
    } else {
      out.push({ type: "text", text: match[0] });
    }
    lastIndex = start + match[0].length;
    if (special || member) {
      // 紧随空格 → 吃掉它（避免重复空格）；EOS → 补一个空格
      if (lastIndex < text.length && /\s/.test(text[lastIndex] ?? "")) {
        out.push({ type: "text", text: " " });
        lastIndex += 1;
      } else if (lastIndex >= text.length) {
        out.push({ type: "text", text: " " });
      }
    }
    match = regex.exec(text);
  }
  if (lastIndex < text.length) out.push({ type: "text", text: text.slice(lastIndex) });
  return out;
}

/**
 * 给后端 transcribe 接口的 member_context：mirror 的 ChatContextResult.memberContext
 * 形如「聊天成员：Alice,Bob」；空成员返回空字符串
 */
export function buildMemberContext(members: Array<{ name?: string; remark?: string }>): string {
  const set = new Set<string>();
  for (const m of members) {
    const display = m.remark?.trim() || m.name?.trim();
    if (display) set.add(display);
  }
  if (set.size === 0) return "";
  return `聊天成员：${[...set].join(",")}`;
}
