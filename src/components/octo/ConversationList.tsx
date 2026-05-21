import { useQueries } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AtSign, ChevronDown, ChevronRight, Layers, Pin } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, getApiUrl } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { useCategories } from "@/api/queries/categories";
import {
  useClearChannelMessages,
  useClearUnread,
} from "@/api/queries/channelActions";
import { useAddPinned, useRemovePinned, usePinned } from "@/api/queries/pinned";
import { type ChannelInfo, ChannelInfoSchema } from "@/api/schemas/channel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChannelType } from "@/const/channel";
import type { ConversationView } from "@/im/conversation";
import { useConversationViews } from "@/im/hooks/useConversationViews";
import { atMeKey, useAtMeStore } from "@/stores/atMe";
import { useCategoriesUi } from "@/stores/categoriesUi";
import { useCurrentChannel } from "@/stores/currentChannel";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";
import { avatarGradient, channelAvatarUrl, getFirstChar, resolveImageURL } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { extractErrorMsg } from "@/utils/extractErrorMsg";
import { formatConversationTime } from "@/utils/time";

const PERSONAL_SECTION_ID = "__personal__";

/** mirror ConversationList filter；'group' = 群+子区，'dm' = 私聊+客服。空 = 主屏全量 */
export type ConversationFilter = "group" | "dm";

interface ConversationListProps {
  /** picker 模式：UI 简化（隐藏时间戳，"置顶" 用文字标签替代 Pin 图标），且默认禁用右键菜单 */
  picker?: boolean;
  /** picker drawer 用 filter 切 group/dm；不传等于显示全部（主屏行为） */
  filter?: ConversationFilter;
}

interface SectionedItem {
  type: "header" | "item";
  /** for headers: stable id used for collapse state */
  sectionId?: string;
  label?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  count?: number;
  conv?: ConversationView;
  pinned?: boolean;
}

export function ConversationList({ picker = false, filter }: ConversationListProps = {}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { conversations: rawConversations, isLoading, error } = useConversationViews();
  const select = useCurrentChannel((s) => s.select);
  const channelId = useCurrentChannel((s) => s.channelId);
  const channelType = useCurrentChannel((s) => s.channelType);
  const atMeCounts = useAtMeStore((s) => s.counts);
  const { data: pinnedItems } = usePinned();
  const spaceId = useSpaceStore(selectCurrentSpaceId);
  const { data: categories } = useCategories(spaceId);
  const collapsed = useCategoriesUi((s) => s.collapsed);
  const toggleCollapse = useCategoriesUi((s) => s.toggleCollapse);
  const pinnedSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of pinnedItems ?? []) s.add(`${p.channel_id}:${p.channel_type}`);
    return s;
  }, [pinnedItems]);

  // mirror ChatConversationList:filterConversation —— picker drawer 按 tab 过滤会话列表
  const conversations = useMemo(() => {
    if (!filter) return rawConversations;
    if (filter === "group") {
      return rawConversations.filter(
        (c) =>
          c.channelType === ChannelType.group ||
          c.channelType === ChannelType.communityTopic,
      );
    }
    return rawConversations.filter(
      (c) =>
        c.channelType === ChannelType.person ||
        c.channelType === ChannelType.customerService,
    );
  }, [rawConversations, filter]);

  // mirror WKAvatar/displayName 等价：按 channelId+type 批量拉 channelInfo，
  // 用 react-query 缓存 5min，解析真实显示名和头像 URL。
  const infoQueries = useQueries({
    queries: conversations.map((c) => ({
      queryKey: ["channel", c.channelType, c.channelId],
      async queryFn(): Promise<ChannelInfo> {
        const data = await api.get(Endpoints.channelInfo(c.channelId, c.channelType)).json();
        return ChannelInfoSchema.parse(data);
      },
      staleTime: 5 * 60_000,
    })),
  });
  const infoByKey = useMemo(() => {
    const m = new Map<string, ChannelInfo>();
    conversations.forEach((c, i) => {
      const info = infoQueries[i]?.data;
      if (info) m.set(`${c.channelId}:${c.channelType}`, info);
    });
    return m;
  }, [conversations, infoQueries]);

  function resolveDisplayName(c: ConversationView): string {
    const info = infoByKey.get(`${c.channelId}:${c.channelType}`);
    return info?.remark?.trim() || info?.name?.trim() || c.name;
  }
  function resolveAvatarUrl(c: ConversationView): string {
    const info = infoByKey.get(`${c.channelId}:${c.channelType}`);
    const baseURL = getApiUrl();
    // mirror App.avatarChannel：优先 channelInfo.logo（可能是相对路径，需 prepend baseURL）
    const logo = info?.logo?.trim();
    if (logo) return resolveImageURL(baseURL, logo);
    return channelAvatarUrl(baseURL, c.channelId, c.channelType, spaceId);
  }

  /**
   * 当选中了某个 Space 且后端返回了分组：
   *   置顶 + 私聊（person/customerService）+ 每个 category 各一段
   * 否则维持旧的 pinned / normal 两段。
   */
  const items: SectionedItem[] = useMemo(() => {
    const pinned: ConversationView[] = [];
    const rest: ConversationView[] = [];
    for (const c of conversations) {
      const key = `${c.channelId}:${c.channelType}`;
      if (pinnedSet.has(key) || c.pinned) pinned.push({ ...c, pinned: true });
      else rest.push(c);
    }

    const out: SectionedItem[] = [];

    // picker 模式：不另起"置顶"段（mirror picker 走 category 分组 / dm 平铺）；
    // pinned 标记保留给 icon 渲染用。
    if (!picker && pinned.length > 0) {
      out.push({ type: "header", sectionId: "__pinned__", label: "置顶", count: pinned.length });
      for (const c of pinned) out.push({ type: "item", conv: c, pinned: true });
    }

    // picker filter='dm' 时全是私聊，无需 category 切分，直接平铺剩余
    if (filter === "dm") {
      // picker 模式下 pinned 没单独抽段，需要把 pinned 也插回去（保持 pinned 在前的顺序）
      if (picker) {
        for (const c of pinned) out.push({ type: "item", conv: { ...c, pinned: true } });
      }
      for (const c of rest) out.push({ type: "item", conv: c });
      return out;
    }

    const useCategorySections = spaceId !== null && (categories?.length ?? 0) > 0;

    if (!useCategorySections) {
      const all = picker ? [...pinned, ...rest] : rest;
      if (all.length > 0) {
        if (!picker && pinned.length > 0) {
          out.push({
            type: "header",
            sectionId: "__all__",
            label: "所有会话",
            count: rest.length,
          });
        }
        for (const c of all) out.push({ type: "item", conv: c, pinned: c.pinned });
      }
      return out;
    }

    // group_no -> category info for fast lookup
    const groupCategory = new Map<string, { id: string; name: string }>();
    for (const cat of categories ?? []) {
      const id = cat.category_id ?? "__default__";
      for (const g of cat.groups) groupCategory.set(g.group_no, { id, name: cat.name });
    }

    // picker 模式：pinned 也需要进 category 分组（mirror 行为）
    const sourceForCategory = picker ? [...pinned, ...rest] : rest;
    const personal: ConversationView[] = [];
    const byCategory = new Map<string, ConversationView[]>();
    const orphans: ConversationView[] = [];
    for (const c of sourceForCategory) {
      if (c.channelType !== ChannelType.group) {
        personal.push(c);
        continue;
      }
      const info = groupCategory.get(c.channelId);
      if (!info) {
        orphans.push(c);
        continue;
      }
      const arr = byCategory.get(info.id);
      if (arr) arr.push(c);
      else byCategory.set(info.id, [c]);
    }

    // picker filter='group' 不显示"私聊"段（也不可能有，conversations 已被预过滤）
    if (personal.length > 0 && filter !== "group") {
      const sid = PERSONAL_SECTION_ID;
      const isCol = collapsed.has(sid);
      out.push({
        type: "header",
        sectionId: sid,
        label: "私聊",
        collapsible: true,
        collapsed: isCol,
        count: personal.length,
      });
      if (!isCol) for (const c of personal) out.push({ type: "item", conv: c });
    }

    for (const cat of categories ?? []) {
      const sid = cat.category_id ?? "__default__";
      const list = byCategory.get(sid) ?? [];
      if (list.length === 0) continue;
      const isCol = collapsed.has(sid);
      out.push({
        type: "header",
        sectionId: sid,
        label: cat.name,
        collapsible: true,
        collapsed: isCol,
        count: list.length,
      });
      if (!isCol) for (const c of list) out.push({ type: "item", conv: c });
    }

    if (orphans.length > 0) {
      const sid = "__orphans__";
      const isCol = collapsed.has(sid);
      out.push({
        type: "header",
        sectionId: sid,
        label: "未分组",
        collapsible: true,
        collapsed: isCol,
        count: orphans.length,
      });
      if (!isCol) for (const c of orphans) out.push({ type: "item", conv: c });
    }

    return out;
  }, [conversations, pinnedSet, spaceId, categories, collapsed, filter, picker]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (items[i]?.type === "header" ? 28 : picker ? 56 : 64),
    overscan: 8,
  });

  const [menuFor, setMenuFor] = useState<{ conv: ConversationView; x: number; y: number } | null>(
    null,
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-(--color-destructive)">
        {error.message}
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-(--color-muted-foreground)">
        加载中…
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
        <p className="text-sm text-(--color-muted-foreground)">还没有任何会话</p>
        <p className="text-xs text-(--color-muted-foreground)/70">
          有人给你发消息或加入群聊后会出现在这里
        </p>
      </div>
    );
  }

  return (
    <>
      <div ref={parentRef} className="h-full overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const it = items[vi.index];
            if (!it) return null;
            if (it.type === "header") {
              const headerBody = (
                <>
                  {it.collapsible &&
                    (it.collapsed ? (
                      <ChevronRight className="mr-1 h-3 w-3" />
                    ) : (
                      <ChevronDown className="mr-1 h-3 w-3" />
                    ))}
                  <span className="truncate">{it.label}</span>
                  {!picker && typeof it.count === "number" && (
                    <span className="ml-1 text-[10px] text-(--color-muted-foreground)/70">
                      {it.count}
                    </span>
                  )}
                </>
              );
              const baseClass = picker
                ? "absolute left-0 right-0 flex items-center bg-(--color-background) px-3 text-[11px] font-medium text-(--color-muted-foreground)/80 tracking-[0.04em]"
                : "absolute left-0 right-0 flex items-center bg-(--color-background) px-3 text-[11px] font-medium uppercase tracking-wider text-(--color-muted-foreground)";
              if (it.collapsible && it.sectionId) {
                const sid = it.sectionId;
                return (
                  <button
                    key={`h-${sid}`}
                    type="button"
                    onClick={() => toggleCollapse(sid)}
                    className={cn(baseClass, "hover:text-(--color-foreground)")}
                    style={{ top: vi.start, height: vi.size }}
                  >
                    {headerBody}
                  </button>
                );
              }
              return (
                <div
                  key={`h-${it.sectionId ?? vi.index}`}
                  className={baseClass}
                  style={{ top: vi.start, height: vi.size }}
                >
                  {headerBody}
                </div>
              );
            }
            const conv = it.conv;
            if (!conv) return null;
            const liveAt = atMeCounts.get(atMeKey(conv.channelId, conv.channelType)) ?? 0;
            const atCount = Math.max(conv.mentionCount, liveAt);
            const isCurrent =
              picker && conv.channelId === channelId && conv.channelType === channelType;
            const isPinned = it.pinned ?? conv.pinned;
            const displayName = resolveDisplayName(conv);
            const avatarUrl = resolveAvatarUrl(conv);
            return (
              <button
                key={`${conv.channelId}:${conv.channelType}`}
                type="button"
                onClick={() => select(conv.channelId, conv.channelType)}
                onContextMenu={
                  picker
                    ? undefined
                    : (e) => {
                        e.preventDefault();
                        setMenuFor({ conv, x: e.clientX, y: e.clientY });
                      }
                }
                className={cn(
                  "absolute left-0 right-0 flex w-full items-center text-left transition-colors hover:bg-(--color-accent)/40",
                  picker
                    ? "gap-3 px-3"
                    : "gap-3 border-b px-3 py-2.5",
                  (conv.unread > 0 || atCount > 0) && !picker && "bg-(--color-accent)/15",
                  isCurrent && "bg-(--color-accent)",
                )}
                style={{ top: vi.start, height: vi.size }}
              >
                <Avatar className={cn("shrink-0", picker ? "h-9 w-9" : "h-10 w-10")}>
                  {avatarUrl && (
                    <AvatarImage
                      src={avatarUrl}
                      alt={displayName}
                      onLoadingStatusChange={(status) => {
                        if (status === "error") {
                          console.warn("[avatar load failed]", avatarUrl);
                        }
                      }}
                    />
                  )}
                  <AvatarFallback
                    className="text-white text-xs"
                    style={{ background: avatarGradient(displayName) }}
                  >
                    {getFirstChar(displayName)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {picker ? (
                    <>
                      <span className="truncate text-[14px] font-medium text-(--color-foreground)">
                        {displayName}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-1.5">
                        {conv.unread > 0 && (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F54A45] px-1 text-[10px] font-semibold leading-none text-white">
                            {conv.unread > 99 ? "99+" : conv.unread}
                          </span>
                        )}
                        {isPinned && (
                          <Layers
                            className="h-3.5 w-3.5 text-[#6569E8]"
                            aria-label="置顶"
                          />
                        )}
                      </span>
                    </>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        {isPinned && (
                          <Pin className="h-3 w-3 shrink-0 fill-(--color-muted-foreground) text-(--color-muted-foreground)" />
                        )}
                        <span className="truncate text-sm font-medium">{displayName}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-(--color-muted-foreground)">
                          {conv.timestamp ? formatConversationTime(conv.timestamp * 1000) : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-(--color-muted-foreground)">
                          {conv.lastDigest}
                        </p>
                        {atCount > 0 && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-(--color-destructive)/15 px-1.5 text-[10px] font-medium leading-4 text-(--color-destructive)">
                            <AtSign className="h-2.5 w-2.5" />
                            {atCount}
                          </span>
                        )}
                        {conv.unread > 0 && (
                          <span className="shrink-0 rounded-full bg-(--color-destructive) px-1.5 text-[10px] font-medium leading-4 text-(--color-destructive-foreground)">
                            {conv.unread > 99 ? "99+" : conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {menuFor && !picker && (
        <ContextMenu menuFor={menuFor} onClose={() => setMenuFor(null)} pinnedSet={pinnedSet} />
      )}
    </>
  );
}

function ContextMenu({
  menuFor,
  onClose,
  pinnedSet,
}: {
  menuFor: { conv: ConversationView; x: number; y: number };
  onClose: () => void;
  pinnedSet: Set<string>;
}) {
  const { conv, x, y } = menuFor;
  const key = `${conv.channelId}:${conv.channelType}`;
  const isPinned = pinnedSet.has(key) || conv.pinned;
  const isGroup = conv.channelType === ChannelType.group;
  const openMoveTo = useCategoriesUi((s) => s.openMoveTo);
  const addPin = useAddPinned();
  const removePin = useRemovePinned();
  const clearUnread = useClearUnread();
  const clearMessages = useClearChannelMessages();

  async function onMarkRead(): Promise<void> {
    try {
      await clearUnread.mutateAsync({
        channelId: conv.channelId,
        channelType: conv.channelType,
      });
      toast.success("已标为已读");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "失败");
    } finally {
      onClose();
    }
  }

  async function onPin(): Promise<void> {
    try {
      if (isPinned) {
        await removePin.mutateAsync({ channelId: conv.channelId, channelType: conv.channelType });
      } else {
        await addPin.mutateAsync({ channelId: conv.channelId, channelType: conv.channelType });
      }
    } catch (err) {
      toast.error(extractErrorMsg(err) || "失败");
    } finally {
      onClose();
    }
  }

  async function onClear(): Promise<void> {
    if (!confirm(`清空「${conv.name}」所有消息？`)) {
      onClose();
      return;
    }
    try {
      await clearMessages.mutateAsync({
        channelId: conv.channelId,
        channelType: conv.channelType,
      });
      toast.success("已清空");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "失败");
    } finally {
      onClose();
    }
  }

  return (
    <DropdownMenu open onOpenChange={(o) => !o && onClose()}>
      <DropdownMenuContent
        align="start"
        className="w-36"
        style={{ position: "fixed", left: x, top: y } as React.CSSProperties}
      >
        {conv.unread > 0 && (
          <DropdownMenuItem onSelect={() => void onMarkRead()}>标为已读</DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void onPin()}>
          {isPinned ? "取消置顶" : "置顶"}
        </DropdownMenuItem>
        {isGroup && (
          <DropdownMenuItem
            onSelect={() => {
              openMoveTo(conv.channelId);
              onClose();
            }}
          >
            移动到分组…
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-(--color-destructive)"
          onSelect={() => void onClear()}
        >
          清空消息
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
