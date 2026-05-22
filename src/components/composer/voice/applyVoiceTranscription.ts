import type { Editor } from "@tiptap/react";
import type { Member } from "@/api/schemas/member";
import {
  buildMentionRegex,
  type MemberInfo,
  type ParsedSegment,
  parseMentionMarkers,
} from "./voiceMentionParser";

export type ReplaceMode = "all" | "selection" | "insert";

export interface ApplyOpts {
  editor: Editor;
  members: Member[];
  text: string;
  replaceMode: ReplaceMode;
  savedSelectedText?: string;
  savedSelectionRange?: { from: number; to: number };
}

/**
 * 把转写文本回填进 tiptap。行为对齐 mirror applyVoiceTranscription：
 *
 * - memberInfos 构造：primary 优先 remark，否则 name；若 name 与 remark 都存在且不同，
 *   再加一条以 name 为 label 的副条目（让 @张三 和 @张三备注 都能命中）
 * - hasMention 先 regex.test，避免无 @ 时按段插（性能 + 让连续中文走原生纯文本路径）
 * - selection 模式：savedSelectionRange 优先；否则在 doc.descendants 里找包含 savedSelectedText 的
 *   text 节点；都找不到 → 整段 setContent 兜底
 * - insert 模式：editor.commands.insertContent
 * - 收尾 editor.commands.focus()
 */
export function applyVoiceTranscription({
  editor,
  members,
  text,
  replaceMode,
  savedSelectedText,
  savedSelectionRange,
}: ApplyOpts): void {
  if (!editor || !text) return;

  // primary: remark 优先；如果 name 与 remark 都存在且不同 → 再加一条 name 的
  const memberInfos: MemberInfo[] = (members ?? []).flatMap((m) => {
    const primaryName = (m.remark?.trim() || m.name || m.uid).trim();
    if (!primaryName) return [];
    const primary: MemberInfo = { uid: m.uid, name: primaryName };
    if (m.name && m.remark && m.remark.trim() !== m.name.trim()) {
      return [primary, { uid: m.uid, name: m.name }];
    }
    return [primary];
  });

  const hasMention = memberInfos.length > 0 && buildMentionRegex(memberInfos).test(text);

  const findRange = (search: string): { from: number; to: number } | null => {
    let found: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (found) return false;
      if (node.isText && typeof node.text === "string") {
        const idx = node.text.indexOf(search);
        if (idx >= 0) {
          found = { from: pos + idx, to: pos + idx + search.length };
          return false;
        }
      }
      return true;
    });
    return found;
  };

  if (hasMention) {
    const segments: ParsedSegment[] = parseMentionMarkers(text, memberInfos);
    if (replaceMode === "all") {
      editor.commands.setContent({
        type: "doc",
        content: [{ type: "paragraph", content: segments }],
      });
    } else if (replaceMode === "selection" && savedSelectedText) {
      const range = savedSelectionRange ?? findRange(savedSelectedText);
      if (range) {
        editor.chain().setTextSelection(range).insertContent(segments).run();
      } else {
        editor.commands.setContent({
          type: "doc",
          content: [{ type: "paragraph", content: segments }],
        });
      }
    } else {
      editor.commands.insertContent(segments);
    }
  } else {
    if (replaceMode === "all") {
      editor.commands.setContent(text);
    } else if (replaceMode === "selection" && savedSelectedText) {
      const range = savedSelectionRange ?? findRange(savedSelectedText);
      if (range) {
        editor.chain().setTextSelection(range).insertContent(text).run();
      } else {
        editor.commands.setContent(text);
      }
    } else {
      editor.commands.insertContent(text);
    }
  }

  editor.commands.focus();
}
