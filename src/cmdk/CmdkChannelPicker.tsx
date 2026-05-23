import { useQueries } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, getApiUrl } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { useCategories } from "@/api/queries/categories";
import { useFriends } from "@/api/queries/contacts";
import { type ChannelInfo, ChannelInfoSchema } from "@/api/schemas/channel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChannelType } from "@/const/channel";
import { useConversationViews } from "@/im/hooks/useConversationViews";
import { useSpaceStore } from "@/stores/space";
import {
  avatarGradient,
  channelAvatarUrl,
  getFirstChar,
  resolveImageURL,
  resolvePersonAvatar,
} from "@/utils/avatar";

export interface PickedTarget {
  channelId: string;
  channelType: number;
  name: string;
  avatar?: string;
}

interface PickerRow {
  kind: "header" | "item" | "hint" | "empty";
  key: string;
  label?: string;
  text?: string;
  section?: string;
  target?: PickedTarget;
}

interface CmdkChannelPickerProps {
  current?: PickedTarget | null;
  onPick: (t: PickedTarget) => void;
  onCancel: () => void;
}

const keyOf = (t: { channelType: number; channelId: string }) =>
  `${t.channelType}:${t.channelId}`;

function typeBadge(type: number): string {
  if (type === ChannelType.person) return "联系人";
  if (type === ChannelType.group) return "频道";
  if (type === ChannelType.communityTopic) return "子区";
  return "其他";
}

function highlight(name: string, kw: string): React.ReactNode {
  const k = kw.trim().toLowerCase();
  if (!k) return name;
  const lower = name.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < name.length) {
    const idx = lower.indexOf(k, i);
    if (idx < 0) {
      nodes.push(name.slice(i));
      break;
    }
    if (idx > i) nodes.push(name.slice(i, idx));
    nodes.push(
      <em
        key={`m-${idx}`}
        className="not-italic font-medium text-(--color-primary) underline decoration-(--color-primary)/40 underline-offset-2"
      >
        {name.slice(idx, idx + k.length)}
      </em>,
    );
    i = idx + k.length;
  }
  return <>{nodes}</>;
}

/**
 * cmdk 底部嵌入式 picker —— B 方案：
 *  - 默认态：只显「最近」+ 提示「输入以搜索全部」
 *  - 搜索态：最近 → 联系人 → 频道 → 子区（全部本地，无远程调用）
 *  - 数据源全是 React Query 已缓存的 query（useConversationViews / useFriends / useCategories）
 */
export function CmdkChannelPicker({
  current,
  onPick,
  onCancel,
}: CmdkChannelPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState("");

  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  const { conversations } = useConversationViews();
  const { data: categories } = useCategories(spaceId);
  const { data: friends } = useFriends();

  // 给最近会话拉 channelInfo（解决真名 / logo）
  const recentInfoQueries = useQueries({
    queries: conversations.map((c) => ({
      queryKey: ["channel", c.channelType, c.channelId],
      async queryFn(): Promise<ChannelInfo> {
        const data = await api
          .get(Endpoints.channelInfo(c.channelId, c.channelType))
          .json();
        return ChannelInfoSchema.parse(data);
      },
      staleTime: 5 * 60_000,
    })),
  });

  // ── 派生四类 targets ──

  // 1) 最近：person + group + topic 全收（保留 conversation 顺序：pin / 时间已在源里）
  //   person 头像优先级（resolvePersonAvatar）：personAvatarByUid.get(uid) > channelInfo.logo > users/{uid}/avatar 兜底
  //   bot 用户在 personAvatarByUid 里有真实 CDN URL，否则 users/{uid}/avatar 大概率 404 → 落首字 fallback

  const recentTargets = useMemo<PickedTarget[]>(() => {
    const baseURL = getApiUrl();
    return conversations.map((c, i) => {
      const info = recentInfoQueries[i]?.data;
      const name = info?.remark?.trim() || info?.name?.trim() || c.channelId;
      let avatar: string | undefined;
      if (c.channelType === ChannelType.person) {
        avatar = resolvePersonAvatar({
          baseURL,
          channelId: c.channelId,
          spaceId,
          ...(info?.logo?.trim() || info?.avatar?.trim()
            ? { logo: info?.logo?.trim() || info?.avatar?.trim() }
            : {}),
        });
      } else {
        const logoFromInfo = info?.logo?.trim() || info?.avatar?.trim();
        avatar = logoFromInfo
          ? resolveImageURL(baseURL, logoFromInfo)
          : channelAvatarUrl(baseURL, c.channelId, c.channelType, spaceId);
      }
      return {
        channelId: c.channelId,
        channelType: c.channelType,
        name,
        avatar,
      };
    });
  }, [conversations, recentInfoQueries, spaceId]);

  // 2) 联系人：useFriends 全 space
  const friendTargets = useMemo<PickedTarget[]>(() => {
    const baseURL = getApiUrl();
    return (friends ?? []).map((f) => {
      const name = f.remark?.trim() || f.name;
      const avatar = resolvePersonAvatar({
        baseURL,
        channelId: f.uid,
        spaceId,
        ...(f.avatar?.trim() && { logo: f.avatar }),
      });
      return {
        channelId: f.uid,
        channelType: ChannelType.person,
        name,
        avatar,
      };
    });
  }, [friends, spaceId]);

  // 3) 频道：useCategories.groups 全 space
  const groupTargets = useMemo<PickedTarget[]>(() => {
    const baseURL = getApiUrl();
    const cats = categories ?? [];
    return cats.flatMap((c) =>
      c.groups.map((g) => ({
        channelId: g.group_no,
        channelType: ChannelType.group,
        name: g.name,
        avatar: channelAvatarUrl(
          baseURL,
          g.group_no,
          ChannelType.group,
          spaceId,
        ),
      })),
    );
  }, [categories, spaceId]);

  // 4) 子区：从 conversations 里取 communityTopic 类型（v1 不做全 space 子区枚举）
  const topicTargets = useMemo<PickedTarget[]>(() => {
    return recentTargets.filter(
      (t) => t.channelType === ChannelType.communityTopic,
    );
  }, [recentTargets]);

  // ── 合并 rows ──
  const rows = useMemo<PickerRow[]>(() => {
    const k = keyword.trim().toLowerCase();
    const seen = new Set<string>();
    const out: PickerRow[] = [];
    const match = (n: string) => !k || n.toLowerCase().includes(k);

    const pushSec = (
      section: string,
      label: string,
      list: PickedTarget[],
    ): void => {
      const hits = list.filter((t) => match(t.name) && !seen.has(keyOf(t)));
      if (!hits.length) return;
      out.push({ kind: "header", key: `h:${section}`, label });
      for (const t of hits) {
        seen.add(keyOf(t));
        out.push({ kind: "item", key: keyOf(t), section, target: t });
      }
    };

    // 最近永远在最上
    pushSec("recent", "最近", recentTargets);

    // 搜索时再展开全 space
    if (k) {
      pushSec("contacts", "联系人", friendTargets);
      pushSec("channels", "频道", groupTargets);
      pushSec("topics", "子区", topicTargets);
    }

    if (!k && out.length > 0) {
      out.push({
        kind: "hint",
        key: "h:start",
        text: "开始输入即可搜索整个 Space 的联系人、频道、子区",
      });
    }
    if (out.length === 0) {
      out.push({ kind: "empty", key: "e" });
    }
    return out;
  }, [keyword, recentTargets, friendTargets, groupTargets, topicTargets]);

  // 首次 focus
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (keyword) setKeyword("");
      else onCancel();
    }
  }

  const matchCount = rows.filter((r) => r.kind === "item").length;

  return (
    <div
      data-octo-cmdk-portal=""
      className="flex min-h-[200px] flex-1 flex-col overflow-hidden border-t border-(--color-border)/60 bg-(--color-muted)/30 dark:bg-(--color-background)/60"
    >
      {/* 搜索头 */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-(--color-border)/50 bg-(--color-popover) px-3 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-(--color-muted-foreground)" />
        <input
          ref={inputRef}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="搜索整个 Space  ·  联系人 / 频道 / 子区"
          autoComplete="off"
          aria-label="目标搜索"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-(--color-muted-foreground)"
        />
        <kbd className="rounded border border-(--color-border)/60 bg-(--color-muted)/60 px-1.5 py-0.5 font-mono text-[10px] text-(--color-muted-foreground)">
          Esc
        </kbd>
      </div>

      {/* 列表 —— flex-1 自适应剩余空间；min-h-0 让 flex 子项可缩；overscroll-contain 阻断滚动链 */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1">
        {rows.map((r) => {
          if (r.kind === "header") {
            return (
              <div
                key={r.key}
                className="px-2 pt-3 pb-1 text-[10.5px] font-semibold tracking-wider text-(--color-muted-foreground)/85"
              >
                {r.label}
              </div>
            );
          }
          if (r.kind === "hint") {
            return (
              <div
                key={r.key}
                className="flex items-center justify-center gap-1.5 px-3 py-3 text-center text-[11.5px] text-(--color-muted-foreground)/85"
              >
                <Search className="h-3 w-3 opacity-70" />
                {r.text}
              </div>
            );
          }
          if (r.kind === "empty") {
            return (
              <div
                key={r.key}
                className="flex flex-col items-center justify-center py-10"
              >
                <span
                  className="mb-3 bg-clip-text text-[30px] leading-none text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #7C5CFC 0%, #00D4AA 100%)",
                  }}
                >
                  ✦
                </span>
                <div className="mb-1 text-[13px] font-medium text-(--color-foreground)">
                  没有匹配的目标
                </div>
                <div className="text-[11px] text-(--color-muted-foreground)">
                  试试少几个字，或检查拼写
                </div>
              </div>
            );
          }
          // item
          if (!r.target) return null;
          const isCurrent =
            current?.channelId === r.target.channelId &&
            current?.channelType === r.target.channelType;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => r.target && onPick(r.target)}
              className="flex min-h-[30px] w-full items-center gap-2 rounded-[10px] px-2 py-1 text-left transition-colors hover:bg-(--color-muted)/60"
            >
              <Avatar className="h-6 w-6 shrink-0">
                {r.target.avatar && (
                  <AvatarImage
                    src={r.target.avatar}
                    alt={r.target.name}
                    onLoadingStatusChange={(s) => {
                      if (s === "error")
                        console.warn(
                          "[cmdk avatar load failed]",
                          r.target?.name,
                          r.target?.channelType,
                          r.target?.channelId,
                          r.target?.avatar,
                        );
                    }}
                  />
                )}
                <AvatarFallback
                  className="text-[10px] font-semibold text-white"
                  style={{ background: avatarGradient(r.target.name) }}
                >
                  {getFirstChar(r.target.name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {highlight(r.target.name, keyword)}
              </span>
              {isCurrent && (
                <span className="shrink-0 rounded bg-(--color-primary)/12 px-1.5 py-0.5 text-[10px] font-medium text-(--color-primary)">
                  当前
                </span>
              )}
              <span className="inline-flex shrink-0 items-center rounded-full bg-(--color-muted)/60 px-1.5 py-0.5 text-[10px] font-medium text-(--color-muted-foreground)">
                {typeBadge(r.target.channelType)}
              </span>
            </button>
          );
        })}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between border-t border-(--color-border)/60 bg-(--color-popover)/60 px-3 py-1 text-[11px] text-(--color-muted-foreground)/80">
        <span className="flex items-center gap-1.5">
          点击选择
          <kbd className="ml-1 rounded border border-(--color-border)/60 bg-(--color-muted)/60 px-1 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>
          取消
        </span>
        <span className="tabular-nums">
          {keyword ? `${matchCount} 个匹配` : `最近 ${matchCount} 条`}
        </span>
      </div>
    </div>
  );
}
