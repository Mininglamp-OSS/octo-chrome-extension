import type { Editor, Range } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import { forwardRef, type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import tippy, { type Instance, type Props } from "tippy.js";
import { getApiUrl } from "@/api/client";
import { isMemberBot, type Member } from "@/api/schemas/member";
import { AiBadge } from "@/components/octo/AiBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChannelType } from "@/const/channel";
import { avatarGradient, getFirstChar } from "@/utils/avatar";

/** mention 列表里的虚拟「@所有人」uid —— 与 mirror 一致 */
export const MENTION_ALL_UID = "-1";
const MENTION_ALL_LABEL = "所有人";

interface MentionRow {
  uid: string;
  name: string;
  avatar?: string;
  isBot: boolean;
  isAll: boolean;
}

interface MentionItemProps {
  items: MentionRow[];
  command: (item: { id: string; label: string }) => void;
}

interface MentionListHandle {
  onKeyDown: (event: { event: KeyboardEvent }) => boolean;
}

function MemberAvatar({ row }: { row: MentionRow }) {
  if (row.isAll) {
    return (
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback
          className="text-[11px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #7B89F4, #9D78F5)" }}
        >
          所
        </AvatarFallback>
      </Avatar>
    );
  }
  return (
    <Avatar className="h-7 w-7 shrink-0">
      {row.avatar && <AvatarImage src={row.avatar} alt={row.name} />}
      <AvatarFallback
        className="text-[11px] font-semibold text-white"
        style={{ background: avatarGradient(row.name) }}
      >
        {getFirstChar(row.name)}
      </AvatarFallback>
    </Avatar>
  );
}

const MentionList = forwardRef(function MentionList(
  { items, command }: MentionItemProps,
  ref: Ref<MentionListHandle>,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function selectItem(idx: number): void {
    const item = items[idx];
    if (item) command({ id: item.uid, label: item.name });
  }

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === "ArrowUp") {
        setSelectedIndex((selectedIndex + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((selectedIndex + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-md border bg-(--color-popover) px-3 py-2 text-xs text-(--color-muted-foreground) shadow-md">
        无匹配成员
      </div>
    );
  }

  return (
    <div className="max-h-72 w-60 overflow-y-auto rounded-md border bg-(--color-popover) p-1 shadow-md">
      {items.map((item, idx) => (
        <button
          key={item.uid}
          ref={(el) => {
            itemRefs.current[idx] = el;
          }}
          type="button"
          onClick={() => selectItem(idx)}
          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
            idx === selectedIndex ? "bg-(--color-primary)/10" : ""
          }`}
        >
          <MemberAvatar row={item} />
          <span className="truncate font-medium">{item.name}</span>
          {item.isBot && <AiBadge className="ml-1" />}
        </button>
      ))}
    </div>
  );
});

async function fetchMembers(getMembers: () => Member[], query: string): Promise<Member[]> {
  const all = getMembers();
  if (!all.length) return [];
  if (!query) return all.slice(0, 50);
  const q = query.toLowerCase();
  return all
    .filter((m) => {
      const name = (m.name ?? "").toLowerCase();
      const remark = (m.remark ?? "").toLowerCase();
      return name.includes(q) || remark.includes(q);
    })
    .slice(0, 50);
}

function memberAvatarUrl(uid: string, avatar?: string): string {
  if (avatar) {
    if (/^(https?:|data:|blob:)/i.test(avatar)) return avatar;
    const base = getApiUrl();
    return base ? `${base}${avatar.startsWith("/") ? avatar.slice(1) : avatar}` : avatar;
  }
  const base = getApiUrl();
  if (!base) return "";
  // 私聊头像：/users/{uid}/avatar
  return `${base}users/${uid}/avatar?v=1`;
}

function toRows(members: Member[], query: string, getBotAvatar?: (uid: string) => string | undefined): MentionRow[] {
  const rows: MentionRow[] = members.map((m) => {
    const isBot = isMemberBot(m);
    const botAvatar = isBot ? getBotAvatar?.(m.uid) : undefined;
    return {
      uid: m.uid,
      name: m.name,
      avatar: botAvatar || memberAvatarUrl(m.uid, m.avatar),
      isBot,
      isAll: false,
    };
  });
  // 「所有人」首行（查询匹配「所」「所有人」「all」「everyone」时保留）
  const q = query.toLowerCase();
  const allMatches =
    !q || "所有人".includes(query) || "all".startsWith(q) || "everyone".startsWith(q);
  if (allMatches) {
    rows.unshift({
      uid: MENTION_ALL_UID,
      name: MENTION_ALL_LABEL,
      isBot: false,
      isAll: true,
    });
  }
  return rows;
}

/** 创建 Mention 扩展，需要在每个 channel 实例化时绑定 channelId */
export function createMentionExtension(
  getChannelType: () => number,
  getMembers: () => Member[],
  onActiveChange?: (active: boolean) => void,
  getBotAvatar?: (uid: string) => string | undefined,
) {
  return Mention.configure({
    HTMLAttributes: { class: "octo-mention" },
    suggestion: {
      char: "@",
      items: async ({ query }) => {
        // 私聊不需要 @mention
        if (getChannelType() === ChannelType.person) return [] as unknown as Member[];
        return fetchMembers(getMembers, query) as unknown as Member[];
      },
      render: () => {
        let component: ReactRenderer<MentionListHandle, MentionItemProps> | null = null;
        let popup: Instance<Props>[] | null = null;
        return {
          onStart(props: {
            editor: Editor;
            clientRect?: (() => DOMRect | null) | null;
            items: Member[];
            command: (a: { id: string; label: string }) => void;
            range: Range;
            query: string;
          }) {
            onActiveChange?.(true);
            const rows = toRows(props.items ?? [], props.query ?? "", getBotAvatar);
            component = new ReactRenderer(MentionList, {
              props: { items: rows, command: props.command },
              editor: props.editor,
            });
            if (!props.clientRect) return;
            popup = tippy("body", {
              getReferenceClientRect: props.clientRect as () => DOMRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: "manual",
              placement: "top-start",
            });
          },
          onUpdate(props: {
            clientRect?: (() => DOMRect | null) | null;
            items: Member[];
            command: (a: { id: string; label: string }) => void;
            query: string;
          }) {
            const rows = toRows(props.items ?? [], props.query ?? "", getBotAvatar);
            component?.updateProps({ items: rows, command: props.command });
            if (props.clientRect && popup?.[0]) {
              popup[0].setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
            }
          },
          onKeyDown(props: { event: KeyboardEvent }) {
            if (props.event.key === "Escape") {
              popup?.[0]?.hide();
              return true;
            }
            return component?.ref?.onKeyDown(props) ?? false;
          },
          onExit() {
            onActiveChange?.(false);
            popup?.[0]?.destroy();
            component?.destroy();
          },
        };
      },
    },
  });
}

/** Mention 抽取结果：uids（不含 all）、是否 @所有人、按顺序的实体 */
export interface MentionInfo {
  uids: string[];
  all: boolean;
  /** 与最终 text 对齐的偏移；offset = 字符位置，length = `@name`.length */
  entities: Array<{ uid: string; offset: number; length: number }>;
}

interface OrderedMention {
  uid: string;
  label: string;
}

function collectMentions(json: unknown): OrderedMention[] {
  const out: OrderedMention[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const n = node as {
      type?: string;
      attrs?: { id?: string; label?: string };
      content?: unknown[];
    };
    if (n.type === "mention" && n.attrs?.id) {
      out.push({ uid: n.attrs.id, label: n.attrs.label ?? n.attrs.id });
    }
    if (Array.isArray(n.content)) for (const c of n.content) walk(c);
  }
  walk(json);
  return out;
}

/** 从 TipTap JSON + 最终 text 算 mentionInfo（offset 对齐 text） */
export function buildMentionInfo(json: unknown, finalText: string): MentionInfo {
  const ordered = collectMentions(json);
  const uids: string[] = [];
  const entities: MentionInfo["entities"] = [];
  let all = false;
  let cursor = 0;

  for (const m of ordered) {
    if (m.uid === MENTION_ALL_UID || m.label === MENTION_ALL_LABEL) {
      all = true;
      // 仍然推进 cursor，跨过 @所有人 的文本位置以避免后续 indexOf 越界
      const idx = finalText.indexOf(`@${MENTION_ALL_LABEL}`, cursor);
      if (idx >= 0) cursor = idx + 1 + MENTION_ALL_LABEL.length;
      continue;
    }
    const needle = `@${m.label}`;
    const idx = finalText.indexOf(needle, cursor);
    if (idx < 0) {
      // 文本里找不到（被用户手动改了？）—— 仅记 uid，不带 entity
      uids.push(m.uid);
      continue;
    }
    if (!uids.includes(m.uid)) uids.push(m.uid);
    entities.push({ uid: m.uid, offset: idx, length: needle.length });
    cursor = idx + needle.length;
  }
  return { uids, all, entities };
}

/** 兼容旧调用 —— 只要 uid 列表 */
export function extractMentionUids(json: unknown): string[] {
  const seen = new Set<string>();
  for (const m of collectMentions(json)) {
    if (m.uid === MENTION_ALL_UID) continue;
    seen.add(m.uid);
  }
  return Array.from(seen);
}
