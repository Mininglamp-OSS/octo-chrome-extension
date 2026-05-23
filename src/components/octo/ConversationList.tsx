import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AtSign, Hash, Layers, Pin } from "lucide-react";
import { type CSSProperties, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getApiUrl } from "@/api/client";
import { useCategories, useMoveGroupToCategory, useSortCategories } from "@/api/queries/categories";
import {
  useClearChannelMessages,
  useClearUnread,
  useToggleConversationTop,
} from "@/api/queries/channelActions";
import { useChannelInfo, useChannelInfos } from "@/api/queries/channels";
// /user/pinned (Rail Pin) 与会话置顶 (stick) 是两套，本文件不再使用 Rail Pin 数据
import { type ChannelInfo, isChannelInfoBot } from "@/api/schemas/channel";
import { AiBadge } from "@/components/octo/AiBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ChannelType } from "@/const/channel";
import { useBotUidSet } from "@/hooks/useBotUidSet";
import { parseParentGroupNo, useExpandedThreadGroups } from "@/hooks/useExpandedThreadGroups";
import type { ConversationView } from "@/im/conversation";
import { useConversationViews } from "@/im/hooks/useConversationViews";
import { atMeKey, useAtMeStore } from "@/stores/atMe";
import { useCategoriesUi } from "@/stores/categoriesUi";
import { useCurrentChannel } from "@/stores/currentChannel";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";
import {
  avatarGradient,
  channelAvatarUrl,
  getFirstChar,
  resolveImageURL,
  resolvePersonAvatar,
} from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { extractErrorMsg } from "@/utils/extractErrorMsg";
import { formatConversationTime } from "@/utils/time";
import { CategorySection } from "./CategorySection";

const PERSONAL_SECTION_ID = "__personal__";
const ORPHANS_SECTION_ID = "__orphans__";

/** mirror ConversationList filter；'group' = 群+子区，'dm' = 私聊+客服。空 = 全量 */
export type ConversationFilter = "group" | "dm";

interface ConversationListProps {
  picker?: boolean;
  filter?: ConversationFilter;
}

interface SectionedItem {
  type: "header" | "item" | "thread";
  /** stable id for collapse state */
  sectionId?: string;
  categoryId?: string | null;
  isDefault?: boolean;
  label?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  count?: number;
  sectionUnread?: number;
  sectionMention?: boolean;
  conv?: ConversationView;
  pinned?: boolean;
  /** thread row 用：子区父群 channelId（仅可视，hover 不到拖拽） */
  parentChannelId?: string;
  /** thread row 用：是否最后一条（控制连线 ::before 是否绘制） */
  threadLast?: boolean;
}

export function ConversationList({ picker = false, filter }: ConversationListProps = {}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { conversations: rawConversations, isLoading, error } = useConversationViews();
  const select = useCurrentChannel((s) => s.select);
  const channelId = useCurrentChannel((s) => s.channelId);
  const channelType = useCurrentChannel((s) => s.channelType);
  const atMeCounts = useAtMeStore((s) => s.counts);
  const spaceId = useSpaceStore(selectCurrentSpaceId);
  const { data: categories } = useCategories(spaceId);
  const collapsed = useCategoriesUi((s) => s.collapsed);
  const toggleCollapse = useCategoriesUi((s) => s.toggleCollapse);
  const moveGroup = useMoveGroupToCategory(spaceId);
  const sortCategories = useSortCategories(spaceId);
  const expandedThreads = useExpandedThreadGroups();

  // mirror ChatConversationList:filterConversation
  const conversations = useMemo(() => {
    if (!filter) return rawConversations;
    if (filter === "group") {
      return rawConversations.filter(
        (c) => c.channelType === ChannelType.group || c.channelType === ChannelType.communityTopic,
      );
    }
    return rawConversations.filter(
      (c) => c.channelType === ChannelType.person || c.channelType === ChannelType.customerService,
    );
  }, [rawConversations, filter]);

  const infoItems = useMemo(
    () =>
      conversations.map((c) => ({
        channelId: c.channelId,
        channelType: c.channelType,
      })),
    [conversations],
  );
  const infoQueries = useChannelInfos(infoItems);
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
    if (c.channelType === ChannelType.person || c.channelType === ChannelType.customerService) {
      const logo = info?.logo?.trim();
      return resolvePersonAvatar({
        baseURL,
        channelId: c.channelId,
        spaceId,
        ...(logo && { logo }),
      });
    }
    const logo = info?.logo?.trim();
    if (logo) return resolveImageURL(baseURL, logo);
    return channelAvatarUrl(baseURL, c.channelId, c.channelType, spaceId);
  }

  /**
   * mirror ConversationList:groupThreadsWithParent —— 把所有 communityTopic
   * 按 parentGroupNo 分桶，渲染父群条后跟随其子区行（如果父群 expanded）。
   */
  const items: SectionedItem[] = useMemo(() => {
    // 1) 把会话按 group / thread 拆分
    const threadsByParent = new Map<string, ConversationView[]>();
    const groupLikes: ConversationView[] = []; // group / customerService / person
    for (const c of conversations) {
      if (c.channelType === ChannelType.communityTopic) {
        const parent = parseParentGroupNo(c.channelId);
        if (!parent) continue;
        const arr = threadsByParent.get(parent);
        if (arr) arr.push(c);
        else threadsByParent.set(parent, [c]);
      } else {
        groupLikes.push(c);
      }
    }
    // 子区按时间倒序
    for (const [k, arr] of threadsByParent) {
      arr.sort((a, b) => b.timestamp - a.timestamp);
      threadsByParent.set(k, arr);
    }

    // 2) pinned 只看 conv.pinned (来自 api.stick === 1)，不再混入 /user/pinned (Rail Pin) ——
    //    会话置顶和 Rail Pin 是两套独立功能
    const all = groupLikes;

    /** 段内排序：pinned 优先，再按 timestamp desc —— mirror sortConversations 同款 */
    const sortInSection = (list: ConversationView[]): ConversationView[] =>
      [...list].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.timestamp - a.timestamp;
      });

    const out: SectionedItem[] = [];

    /** push 一个群条 + 它的子区（如果展开） */
    const pushGroupWithThreads = (c: ConversationView, isPinned: boolean): void => {
      out.push({ type: "item", conv: c, pinned: isPinned });
      if (c.channelType !== ChannelType.group) return;
      const threads = threadsByParent.get(c.channelId);
      if (!threads || threads.length === 0) return;
      if (!expandedThreads.isExpanded(c.channelId)) return;
      threads.forEach((t, i) => {
        out.push({
          type: "thread",
          conv: t,
          parentChannelId: c.channelId,
          threadLast: i === threads.length - 1,
        });
      });
    };

    // === filter='dm'：纯平铺，无 category/子区 ===
    if (filter === "dm") {
      for (const c of sortInSection(all)) out.push({ type: "item", conv: c, pinned: c.pinned });
      return out;
    }

    // === 群 + 主屏路径（mirror 不单独"置顶"段，归属看后端 categories） ===

    const useCategorySections = spaceId !== null && (categories?.length ?? 0) > 0;

    // 没有 category：直接平铺所有
    if (!useCategorySections) {
      for (const c of sortInSection(all)) pushGroupWithThreads(c, c.pinned);
      return out;
    }

    // group_no -> category info 快查
    const groupCategory = new Map<string, { id: string }>();
    for (const cat of categories ?? []) {
      const id = cat.category_id ?? "__default__";
      for (const g of cat.groups) groupCategory.set(g.group_no, { id });
    }

    const personal: ConversationView[] = [];
    const byCategory = new Map<string, ConversationView[]>();
    const orphans: ConversationView[] = [];
    for (const c of all) {
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
    // 每个分桶段内按 pinned 优先 + timestamp desc 排序
    const sortedPersonal = sortInSection(personal);
    const sortedOrphans = sortInSection(orphans);
    for (const [k, v] of byCategory) byCategory.set(k, sortInSection(v));

    function aggregate(list: ConversationView[]): { unread: number; mention: boolean } {
      let unread = 0;
      let mention = false;
      for (const c of list) {
        unread += c.unread;
        const live = atMeCounts.get(atMeKey(c.channelId, c.channelType)) ?? 0;
        if (live > 0 || c.mentionCount > 0) mention = true;
      }
      return { unread, mention };
    }

    // 主屏才显「私聊」段（filter='group' 时已被 conversations 预过滤掉）
    if (sortedPersonal.length > 0 && filter !== "group") {
      const sid = PERSONAL_SECTION_ID;
      const isCol = collapsed.has(sid);
      const agg = aggregate(sortedPersonal);
      out.push({
        type: "header",
        sectionId: sid,
        categoryId: null,
        isDefault: true,
        label: "私聊",
        collapsible: true,
        collapsed: isCol,
        count: sortedPersonal.length,
        sectionUnread: agg.unread,
        sectionMention: agg.mention,
      });
      if (!isCol)
        for (const c of sortedPersonal) out.push({ type: "item", conv: c, pinned: c.pinned });
    }

    for (const cat of categories ?? []) {
      const sid = cat.category_id ?? "__default__";
      const list = byCategory.get(sid) ?? [];
      const isCol = collapsed.has(sid);
      const agg = aggregate(list);
      out.push({
        type: "header",
        sectionId: sid,
        categoryId: cat.category_id,
        isDefault: cat.is_default ?? false,
        label: cat.name,
        collapsible: true,
        collapsed: isCol,
        count: list.length,
        sectionUnread: agg.unread,
        sectionMention: agg.mention,
      });
      if (!isCol) for (const c of list) pushGroupWithThreads(c, c.pinned);
    }

    if (sortedOrphans.length > 0) {
      const sid = ORPHANS_SECTION_ID;
      const isCol = collapsed.has(sid);
      const agg = aggregate(sortedOrphans);
      out.push({
        type: "header",
        sectionId: sid,
        categoryId: null,
        isDefault: true,
        label: "未分组",
        collapsible: true,
        collapsed: isCol,
        count: sortedOrphans.length,
        sectionUnread: agg.unread,
        sectionMention: agg.mention,
      });
      if (!isCol) for (const c of sortedOrphans) pushGroupWithThreads(c, c.pinned);
    }

    return out;
  }, [conversations, spaceId, categories, collapsed, filter, atMeCounts, expandedThreads]);

  // 仅"群条"可作为 drag source（子区 / dm / 客服 不参与）
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // 拖动中的对象：group conv 或 category（用于 DragOverlay + 源 row 半透明）
  type ActiveDrag =
    | { type: "group"; channelId: string; name: string; avatarUrl: string }
    | { type: "category"; categoryId: string; name: string };
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  function dbgDnd(...args: unknown[]): void {
    // biome-ignore lint/suspicious/noConsole: 仅 DEV 环境调试拖拽 sensor / dropTarget
    if (import.meta.env.DEV) console.debug("[octo:dnd]", ...args);
  }

  async function handleDragEnd(e: DragEndEvent): Promise<void> {
    const { active, over } = e;
    setActiveDrag(null);
    document.body.style.cursor = "";
    dbgDnd("end", {
      active: active.id,
      over: over?.id,
      activeData: active.data.current,
      overData: over?.data.current,
    });
    if (!over) {
      toast("拖到分组名字上松手才能移动");
      return;
    }
    const activeData = active.data.current as
      | { type?: "group" | "category"; categoryId?: string | null }
      | undefined;
    const overData = over.data.current as
      | { type?: "group" | "category"; categoryId?: string | null }
      | undefined;
    if (activeData?.type === "category") {
      // octo-web ConversationListGrouped:140-160 — 对完整 categories 数组做 arrayMove，
      // 默认分组也允许重排（mirror 把它隐藏所以追加在尾部，octo-ext 显示默认分组就直接全量）
      const cats = categories ?? [];
      const overIdStr = String(over.id);
      const oldIdx = cats.findIndex((c) => `cat::${c.category_id}` === String(active.id));
      const newIdx = cats.findIndex((c) => `cat::${c.category_id}` === overIdStr);
      if (oldIdx < 0 || newIdx < 0) {
        toast("拖到分组名字上松手才能排序");
        return;
      }
      if (oldIdx === newIdx) return;
      const newOrder = arrayMove(cats, oldIdx, newIdx)
        .map((c) => c.category_id)
        .filter((id): id is string => Boolean(id));
      try {
        await sortCategories.mutateAsync(newOrder);
      } catch (err) {
        toast.error(extractErrorMsg(err) || "排序失败");
      }
      return;
    }

    if (activeData?.type !== "group") return;

    const groupNo = String(active.id).replace(/^conv::/, "");
    const overIdStr = String(over.id);

    // 解析目标 category：拖到 cat::xxx (drop target) 或 conv::xxx (同 category 下的会话)
    let targetCategoryId: string | null | undefined;
    if (overIdStr.startsWith("cat::") || overIdStr.startsWith("conv::")) {
      targetCategoryId = overData?.categoryId;
    }
    if (targetCategoryId === undefined) {
      toast("子区/空白不是有效目标，请拖到分组名字上");
      return;
    }

    // 默认分组：mirror PR #1007 起需要传真实 UUID，不能空串
    let realId = targetCategoryId;
    if (realId === null) {
      const def = (categories ?? []).find((c) => c.is_default);
      realId = def?.category_id ?? null;
    }
    if (!realId) {
      toast.error("默认分组不可用");
      return;
    }

    // 与原归属相同直接跳过，避免抖动
    if (activeData.categoryId === targetCategoryId) {
      toast("已在该分组");
      return;
    }

    try {
      await moveGroup.mutateAsync({ groupNo, categoryId: realId });
    } catch (err) {
      toast.error(extractErrorMsg(err) || "移动失败");
    }
  }

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      const it = items[i];
      if (!it) return 0;
      if (it.type === "header") return 28;
      if (it.type === "thread") return 32;
      return picker ? 36 : 64;
    },
    overscan: 8,
  });

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
      <DndContext
        sensors={sensors}
        onDragStart={(e) => {
          dbgDnd("start", e.active.id, e.active.data.current);
          const d = e.active.data.current as
            | { type?: "group" | "category"; categoryId?: string | null }
            | undefined;
          if (d?.type === "category" && d.categoryId) {
            const cat = (categories ?? []).find((c) => c.category_id === d.categoryId);
            if (cat) {
              setActiveDrag({
                type: "category",
                categoryId: d.categoryId,
                name: cat.name,
              });
              document.body.style.cursor = "grabbing";
            }
            return;
          }
          if (d?.type === "group") {
            const cid = String(e.active.id).replace(/^conv::/, "");
            const conv = conversations.find((c) => c.channelId === cid);
            if (conv) {
              setActiveDrag({
                type: "group",
                channelId: cid,
                name: resolveDisplayName(conv),
                avatarUrl: resolveAvatarUrl(conv),
              });
              document.body.style.cursor = "grabbing";
            }
          }
        }}
        onDragCancel={() => {
          setActiveDrag(null);
          document.body.style.cursor = "";
        }}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
        <div ref={parentRef} className="h-full overflow-y-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const it = items[vi.index];
              if (!it) return null;

              if (it.type === "header") {
                if (!it.sectionId) return null;
                const sid = it.sectionId;
                const isDefault = it.isDefault ?? false;
                return (
                  <CategorySection
                    key={`h-${sid}`}
                    categoryId={it.categoryId ?? null}
                    sortableId={null}
                    name={it.label ?? ""}
                    count={it.count ?? 0}
                    unreadCount={it.sectionUnread ?? 0}
                    hasMention={it.sectionMention ?? false}
                    collapsed={it.collapsed ?? false}
                    isDefault={isDefault}
                    orderedCategoryIds={(categories ?? [])
                      .map((c) => c.category_id)
                      .filter((id): id is string => Boolean(id))}
                    onToggle={() => toggleCollapse(sid)}
                    topPx={vi.start}
                    heightPx={vi.size}
                  />
                );
              }

              if (it.type === "thread") {
                const conv = it.conv;
                if (!conv) return null;
                return (
                  <ThreadRow
                    key={`t-${conv.channelId}`}
                    conv={conv}
                    isCurrent={conv.channelId === channelId && conv.channelType === channelType}
                    atCount={Math.max(
                      conv.mentionCount,
                      atMeCounts.get(atMeKey(conv.channelId, conv.channelType)) ?? 0,
                    )}
                    displayName={resolveDisplayName(conv)}
                    threadLast={it.threadLast ?? false}
                    onSelect={() => select(conv.channelId, conv.channelType)}
                    topPx={vi.start}
                    heightPx={vi.size}
                  />
                );
              }

              const conv = it.conv;
              if (!conv) return null;
              const categoryOfConv = (() => {
                if (filter === "dm") return null;
                for (const cat of categories ?? []) {
                  if (cat.groups.some((g) => g.group_no === conv.channelId)) {
                    return cat.category_id ?? null;
                  }
                }
                return null;
              })();
              const hasThreads =
                conv.channelType === ChannelType.group &&
                rawConversations.some(
                  (c) =>
                    c.channelType === ChannelType.communityTopic &&
                    parseParentGroupNo(c.channelId) === conv.channelId,
                );
              return (
                <ConvRow
                  key={`${conv.channelId}:${conv.channelType}`}
                  conv={conv}
                  pinned={it.pinned ?? conv.pinned}
                  isCurrent={conv.channelId === channelId && conv.channelType === channelType}
                  atCount={Math.max(
                    conv.mentionCount,
                    atMeCounts.get(atMeKey(conv.channelId, conv.channelType)) ?? 0,
                  )}
                  displayName={resolveDisplayName(conv)}
                  avatarUrl={resolveAvatarUrl(conv)}
                  onSelect={() => select(conv.channelId, conv.channelType)}
                  topPx={vi.start}
                  heightPx={vi.size}
                  sortable={filter !== "dm" && conv.channelType === ChannelType.group}
                  categoryOfConv={categoryOfConv}
                  picker={picker}
                  hasThreads={hasThreads}
                  threadsExpanded={expandedThreads.isExpanded(conv.channelId)}
                  onToggleThreads={() => expandedThreads.toggle(conv.channelId)}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag?.type === "group" ? (
            <div
              className="flex h-9 w-fit max-w-[220px] items-center gap-2 rounded-md border border-(--color-border) bg-(--color-background)/95 px-2 shadow-lg ring-1 backdrop-blur-sm"
              style={{ "--tw-ring-color": "rgba(101,105,232,0.35)" } as React.CSSProperties}
            >
              <Avatar className="h-[26px] w-[26px] shrink-0">
                {activeDrag.avatarUrl && (
                  <AvatarImage src={activeDrag.avatarUrl} alt={activeDrag.name} />
                )}
                <AvatarFallback
                  className="text-white text-xs"
                  style={{ background: avatarGradient(activeDrag.name) }}
                >
                  {getFirstChar(activeDrag.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-[13px] font-medium text-(--color-foreground)">
                {activeDrag.name}
              </span>
            </div>
          ) : activeDrag?.type === "category" ? (
            <div
              className="flex h-7 w-fit max-w-[200px] items-center gap-1 rounded-md border border-(--color-border) bg-(--color-background)/95 px-2 shadow-lg ring-1 backdrop-blur-sm"
              style={{ "--tw-ring-color": "rgba(101,105,232,0.35)" } as React.CSSProperties}
            >
              <span className="truncate text-[12px] font-medium text-(--color-foreground)">
                {activeDrag.name}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

interface ConvRowProps {
  conv: ConversationView;
  pinned: boolean;
  isCurrent: boolean;
  atCount: number;
  displayName: string;
  avatarUrl: string;
  onSelect: () => void;
  topPx: number;
  heightPx: number;
  sortable: boolean;
  categoryOfConv: string | null;
  picker: boolean;
  hasThreads: boolean;
  threadsExpanded: boolean;
  onToggleThreads: () => void;
}

function ConvRow(props: ConvRowProps) {
  if (props.sortable) return <SortableConvRow {...props} />;
  return <StaticConvRow {...props} />;
}

function StaticConvRow(props: ConvRowProps) {
  const {
    conv,
    pinned,
    isCurrent,
    atCount,
    displayName,
    avatarUrl,
    onSelect,
    topPx,
    heightPx,
    picker,
    hasThreads,
    threadsExpanded,
    onToggleThreads,
  } = props;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={
            hasThreads
              ? (e) => {
                  e.preventDefault();
                  onToggleThreads();
                }
              : undefined
          }
          className={cn(
            "group absolute left-0 right-0 flex w-full items-center text-left transition-colors hover:bg-(--color-accent)/40",
            picker ? "gap-2 px-2" : "gap-3 border-b px-3 py-2.5",
            !picker && (conv.unread > 0 || atCount > 0) && "bg-(--color-accent)/15",
            picker && pinned && "bg-[color-mix(in_oklch,#6569E8_8%,transparent)]",
            isCurrent && "bg-(--color-accent)",
          )}
          style={{ top: topPx, height: heightPx }}
        >
          <ConvRowBody
            conv={conv}
            pinned={pinned}
            atCount={atCount}
            displayName={displayName}
            avatarUrl={avatarUrl}
            picker={picker}
            hasThreads={hasThreads}
            threadsExpanded={threadsExpanded}
            onToggleThreads={onToggleThreads}
          />
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        <ConvMenuItems conv={conv} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function SortableConvRow(props: ConvRowProps) {
  const {
    conv,
    pinned,
    isCurrent,
    atCount,
    displayName,
    avatarUrl,
    onSelect,
    topPx,
    heightPx,
    categoryOfConv,
    picker,
    hasThreads,
    threadsExpanded,
    onToggleThreads,
  } = props;
  // useDraggable：只可拖、不参与排序占位 —— DragOverlay 负责跟手 ghost，
  // 原 row 保留在原位 opacity 0.4，与 mirror CompactGroupItem 一致
  const { setNodeRef, attributes, listeners, isDragging, transform } = useDraggable({
    id: `conv::${conv.channelId}`,
    data: { type: "group", categoryId: categoryOfConv },
  });
  const style: CSSProperties = {
    top: topPx,
    height: heightPx,
    // useDraggable 自带 transform，DragOverlay 模式下 reset 为 0；这里仅做 fallback
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: dnd-kit attributes 提供 role/tabIndex */}
        <div
          ref={setNodeRef}
          onClick={onSelect}
          onDoubleClick={
            hasThreads
              ? (e) => {
                  e.preventDefault();
                  onToggleThreads();
                }
              : undefined
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") onSelect();
          }}
          className={cn(
            "group absolute left-0 right-0 flex w-full cursor-pointer items-center text-left transition-colors hover:bg-(--color-accent)/40",
            picker ? "gap-2 px-2" : "gap-3 border-b px-3 py-2.5",
            !picker && (conv.unread > 0 || atCount > 0) && "bg-(--color-accent)/15",
            picker && pinned && "bg-[color-mix(in_oklch,#6569E8_8%,transparent)]",
            isCurrent && "bg-(--color-accent)",
          )}
          style={style}
          {...attributes}
        >
          <ConvRowBody
            conv={conv}
            pinned={pinned}
            atCount={atCount}
            displayName={displayName}
            avatarUrl={avatarUrl}
            picker={picker}
            hasThreads={hasThreads}
            threadsExpanded={threadsExpanded}
            onToggleThreads={onToggleThreads}
            dragListeners={listeners}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        <ConvMenuItems conv={conv} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ConvRowBody({
  conv,
  pinned,
  atCount,
  displayName,
  avatarUrl,
  picker,
  hasThreads,
  threadsExpanded,
  onToggleThreads,
  dragListeners,
}: {
  conv: ConversationView;
  pinned: boolean;
  atCount: number;
  displayName: string;
  avatarUrl: string;
  picker: boolean;
  hasThreads: boolean;
  threadsExpanded: boolean;
  onToggleThreads: () => void;
  dragListeners?: Record<string, unknown>;
}) {
  const botSet = useBotUidSet();
  const { data: info } = useChannelInfo(
    conv.channelType === ChannelType.person ? conv.channelId : null,
    conv.channelType,
  );
  const isBot =
    conv.channelType === ChannelType.person &&
    (botSet.has(conv.channelId) || isChannelInfoBot(info));
  return (
    <>
      {/* 拖拽 handle —— picker 模式 + sortable 才显示。inline 占位，hover 时 opacity 1 + 接收 pointer。
          关键：pointer-events-none 默认禁用，hover 才 auto —— 与 mirror 一致避免 sensor 在隐藏态被触发 */}
      {picker && dragListeners && (
        // biome-ignore lint/a11y/noStaticElementInteractions: 仅作为 dnd-kit listeners 触发点
        <span
          className="pointer-events-none flex h-4 w-3 shrink-0 cursor-grab items-center justify-center text-(--color-muted-foreground) opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          {...dragListeners}
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
            <circle cx="3" cy="3" r="1.2" fill="currentColor" />
            <circle cx="7" cy="3" r="1.2" fill="currentColor" />
            <circle cx="3" cy="7" r="1.2" fill="currentColor" />
            <circle cx="7" cy="7" r="1.2" fill="currentColor" />
            <circle cx="3" cy="11" r="1.2" fill="currentColor" />
            <circle cx="7" cy="11" r="1.2" fill="currentColor" />
          </svg>
        </span>
      )}

      <Avatar className={cn("shrink-0", picker ? "h-[26px] w-[26px]" : "h-10 w-10")}>
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
            <span className="truncate text-[13px] font-medium text-(--color-foreground)">
              {displayName}
            </span>
            {isBot && <AiBadge size="sm" />}
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              {hasThreads && (
                // biome-ignore lint/a11y/useSemanticElements: 父行已是 <button>，内嵌 <button> 是无效 HTML
                // biome-ignore lint/a11y/noStaticElementInteractions: span 作为图标按钮
                <span
                  role="button"
                  tabIndex={0}
                  className="-mr-1 grid h-6 w-6 cursor-pointer place-items-center rounded-full text-[#6569E8] transition-colors hover:bg-(--color-accent)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleThreads();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleThreads();
                    }
                  }}
                  title={threadsExpanded ? "收起子区" : "展开子区"}
                >
                  <Layers className="h-3.5 w-3.5" />
                </span>
              )}
              {conv.unread > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F54A45] px-1 text-[10px] font-semibold leading-none text-white">
                  {conv.unread > 99 ? "99+" : conv.unread}
                </span>
              )}
              {pinned && !hasThreads && conv.channelType === ChannelType.group && (
                <Layers className="h-3.5 w-3.5 text-[#6569E8]" aria-label="置顶" />
              )}
            </span>
          </>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              {pinned && (
                <Pin className="h-3 w-3 shrink-0 fill-(--color-muted-foreground) text-(--color-muted-foreground)" />
              )}
              <span className="truncate text-sm font-medium">{displayName}</span>
              {isBot && <AiBadge size="sm" />}
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
    </>
  );
}

interface ThreadRowProps {
  conv: ConversationView;
  isCurrent: boolean;
  atCount: number;
  displayName: string;
  threadLast: boolean;
  onSelect: () => void;
  topPx: number;
  heightPx: number;
}

/** mirror .wk-conv-compact-item--thread：缩进 52、行高 32、字 13/400、L 形连线 */
function ThreadRow({
  conv,
  isCurrent,
  atCount,
  displayName,
  threadLast,
  onSelect,
  topPx,
  heightPx,
}: ThreadRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "absolute left-0 right-0 flex w-full items-center gap-1 pr-2 text-left transition-colors hover:bg-(--color-accent)/40",
            isCurrent && "bg-(--color-accent)",
          )}
          style={{ top: topPx, height: heightPx, paddingLeft: 52 }}
        >
          {/* L 形连线：横向 10px / 竖向到中线，绝对定位在父按钮的 left:40 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute border-(--color-border)"
            style={{
              left: 40,
              top: 0,
              height: "50%",
              width: 10,
              borderLeftWidth: 1,
              borderBottomWidth: 1,
              borderBottomLeftRadius: 3,
            }}
          />
          {/* 若不是最后一个子区，再画一条向下的延伸线（连下一个 thread） */}
          {!threadLast && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bg-(--color-border)"
              style={{ left: 40, top: "50%", bottom: 0, width: 1 }}
            />
          )}

          <Hash className="h-[13px] w-[13px] shrink-0 text-(--color-muted-foreground)" />
          <span className="ml-1 truncate text-[13px] font-normal text-(--color-foreground)">
            {displayName}
          </span>

          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {atCount > 0 && (
              <span className="inline-flex h-3 min-w-3 items-center justify-center rounded-full bg-(--color-destructive)/15 px-1 text-[10px] font-semibold leading-none text-(--color-destructive)">
                @
              </span>
            )}
            {conv.unread > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F54A45] px-1 text-[10px] font-semibold leading-none text-white">
                {conv.unread > 99 ? "99+" : conv.unread}
              </span>
            )}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        <ConvMenuItems conv={conv} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * 单条会话的右键菜单项内容（不含 Trigger / Content 包装），由父 ConvRow 套
 * `<ContextMenu><ContextMenuTrigger asChild>...<ContextMenuContent>...</ContextMenuContent></ContextMenu>` 使用。
 */
function ConvMenuItems({ conv }: { conv: ConversationView }) {
  // 会话置顶来源是后端 channel.stick，跟 /user/pinned (Rail Pin) 是两套
  const isPinned = conv.pinned;
  const isGroup = conv.channelType === ChannelType.group;
  const openMoveTo = useCategoriesUi((s) => s.openMoveTo);
  const toggleTop = useToggleConversationTop();
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
    }
  }

  async function onPin(): Promise<void> {
    try {
      await toggleTop.mutateAsync({
        channelId: conv.channelId,
        channelType: conv.channelType,
        top: !isPinned,
      });
    } catch (err) {
      toast.error(extractErrorMsg(err) || "失败");
    }
  }

  async function onClear(): Promise<void> {
    if (!confirm(`清空「${conv.name}」所有消息?`)) return;
    try {
      await clearMessages.mutateAsync({
        channelId: conv.channelId,
        channelType: conv.channelType,
      });
      toast.success("已清空");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "失败");
    }
  }

  return (
    <>
      {conv.unread > 0 && (
        <ContextMenuItem onSelect={() => void onMarkRead()}>标为已读</ContextMenuItem>
      )}
      <ContextMenuItem onSelect={() => void onPin()}>
        {isPinned ? "取消置顶" : "置顶"}
      </ContextMenuItem>
      {isGroup && (
        <ContextMenuItem onSelect={() => openMoveTo(conv.channelId)}>移动到分组…</ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem className="text-(--color-destructive)" onSelect={() => void onClear()}>
        清空消息
      </ContextMenuItem>
    </>
  );
}

// （所有 imports 都已使用，无需 void 占位）

// （所有 imports 都已使用，无需 void 占位）
