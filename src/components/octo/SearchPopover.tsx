import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, getApiUrl } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { useChannelInfos } from "@/api/queries/channels";
import { useFriends } from "@/api/queries/contacts";
import { isChannelInfoBot } from "@/api/schemas/channel";
import { type SearchResult, SearchResultSchema } from "@/api/schemas/search";
import { AiBadge } from "@/components/octo/AiBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChannelType } from "@/const/channel";
import { useBotUidSet } from "@/hooks/useBotUidSet";
import { useCurrentChannel } from "@/stores/currentChannel";
import { useSpaceStore } from "@/stores/space";
import { useUIStore } from "@/stores/ui";
import {
  avatarGradient,
  channelAvatarUrl,
  getFirstChar,
  resolvePersonAvatar,
} from "@/utils/avatar";
import { cn } from "@/utils/cn";

type Tab = "contacts" | "groups" | "files";

const TABS: { key: Tab; label: string }[] = [
  { key: "contacts", label: "联系人" },
  { key: "groups", label: "群组" },
  { key: "files", label: "文件" },
];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

export function SearchPopover() {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [tab, setTab] = useState<Tab>("contacts");
  const debouncedKw = useDebouncedComposable(keyword, 250);
  const isDefault = debouncedKw.trim() === "";

  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  const select = useCurrentChannel((s) => s.select);
  const openLightbox = useUIStore((s) => s.openLightbox);

  // 联系人默认态用 friend/sync 全量；群组/文件默认态走 POST /search/global 空 kw 兜底（对齐 mirror）
  const { data: friendsData } = useFriends();
  // mirror OctoSearchPopover：files tab 用 content_type=[8]，其它 tab 空数组
  const contentTypes = tab === "files" ? [8] : [];
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["sidepanel-search", spaceId, debouncedKw.trim(), contentTypes.join(",")],
    enabled: open,
    staleTime: 15_000,
    async queryFn(): Promise<SearchResult> {
      const searchParams = spaceId ? { space_id: spaceId } : undefined;
      const raw = await api
        .post(Endpoints.searchGlobal, {
          json: {
            keyword: debouncedKw.trim(),
            content_type: contentTypes,
            page: 1,
            limit: 20,
          },
          ...(searchParams && { searchParams }),
        })
        .json();
      return SearchResultSchema.parse(raw);
    },
  });

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) {
      setKeyword("");
      setTab("contacts");
    }
  }

  function go(channelId: string, channelType: number): void {
    select(channelId, channelType);
    setOpen(false);
  }

  // 默认态联系人用 friend/sync 全量（mirror 风格），可滚到底；
  // 群组/文件默认态来自 /search/global（mirror 后端在空 kw 时会返默认列表）。
  // friend.category === "bot" 直接代表 AI；搜索结果的 isBot 由后端 category/robot/bot_type 推得
  const allFriends = (friendsData ?? []).map((f) => ({
    uid: f.uid,
    name: f.remark || f.name,
    avatar: f.avatar,
    isBot: f.category === "bot",
  }));
  const friends = isDefault
    ? allFriends
    : (data?.friends ?? []).map((f) => ({
        uid: f.uid,
        name: f.name,
        avatar: f.avatar,
        isBot: f.isBot,
      }));
  const groups = data?.groups ?? [];
  const files = data?.files ?? [];
  const counts: Record<Tab, number> = {
    contacts: friends.length,
    groups: groups.length,
    files: files.length,
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="搜索">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-80 overflow-hidden rounded-xl p-0 shadow-xl"
      >
        <SearchInput value={keyword} onChange={setKeyword} />
        <TabBar tab={tab} counts={counts} onChange={setTab} />
        <ResultList
          tab={tab}
          loading={isLoading || isFetching}
          loaded={data !== undefined || (isDefault && friendsData !== undefined)}
          keyword={debouncedKw}
          friends={friends}
          groups={groups}
          files={files}
          onSelectChannel={go}
          onOpenFile={(f) => {
            if (IMAGE_EXT.test(f.name)) {
              openLightbox({ url: f.url, name: f.name });
            } else {
              window.open(f.url, "_blank", "noopener,noreferrer");
            }
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const composingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // PopoverContent 自带 autofocus 行为，但 input 在内部，主动 focus 一次更稳
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="m-3 flex items-center gap-2 rounded-lg bg-(--color-muted)/50 px-3 py-2">
      <Search className="h-3.5 w-3.5 shrink-0 text-(--color-muted-foreground)" />
      <input
        ref={inputRef}
        value={value}
        placeholder="搜索联系人、群组、文件…"
        onChange={(e) => {
          const next = e.target.value;
          if (composingRef.current) {
            // IME 组词中：先把可控字符串同步过去，但不触发上游 debounce 派发的实际请求
            // useState 的 setter 保持 UI 同步即可
            onChange(next);
            return;
          }
          onChange(next);
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          onChange((e.target as HTMLInputElement).value);
        }}
        className="flex-1 bg-transparent text-[13px] font-medium text-(--color-foreground) outline-none placeholder:text-(--color-muted-foreground)"
      />
    </div>
  );
}

function TabBar({
  tab,
  counts,
  onChange,
}: {
  tab: Tab;
  counts: Record<Tab, number>;
  onChange: (t: Tab) => void;
}) {
  return (
    <div className="flex border-b border-(--color-border)/60 px-2">
      {TABS.map((t) => {
        const active = tab === t.key;
        const count = counts[t.key];
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent px-2 py-2.5 text-[13px] font-medium transition-colors",
              active
                ? "border-(--color-primary) text-(--color-primary)"
                : "text-(--color-muted-foreground) hover:text-(--color-foreground)",
            )}
          >
            <span>{t.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium leading-none",
                  active
                    ? "bg-(--color-primary)/15 text-(--color-primary)"
                    : "bg-(--color-muted) text-(--color-muted-foreground)",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ResultList({
  tab,
  loading,
  loaded,
  keyword,
  friends,
  groups,
  files,
  onSelectChannel,
  onOpenFile,
}: {
  tab: Tab;
  loading: boolean;
  loaded: boolean;
  keyword: string;
  friends: { uid: string; name: string; avatar?: string; isBot: boolean }[];
  groups: SearchResult["groups"];
  files: SearchResult["files"];
  onSelectChannel: (channelId: string, channelType: number) => void;
  onOpenFile: (f: SearchResult["files"][number]) => void;
}) {
  const baseURL = getApiUrl();
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  const botSet = useBotUidSet();

  // contacts tab + 搜索态：对命中的 uid 拉 channelInfo（命中数已被后端 limit:20 兜底，安全）
  // 默认态完全靠 botSet（来自 useFriends 全量 + useMyBots，已涵盖本地全部 AI），
  // 不再对几千条 friends 发请求 → 修复"点搜索按钮就崩"的请求洪峰
  const isSearchingContacts = tab === "contacts" && keyword.trim() !== "";
  const contactUids = isSearchingContacts ? friends.map((f) => f.uid).slice(0, 30) : [];
  const contactInfoItems = useMemo(
    () => contactUids.map((uid) => ({ channelId: uid, channelType: ChannelType.person })),
    [contactUids],
  );
  const contactInfoQueries = useChannelInfos(contactInfoItems);
  const channelBotSet = useMemo(() => {
    const set = new Set<string>();
    contactUids.forEach((uid, i) => {
      if (isChannelInfoBot(contactInfoQueries[i]?.data)) set.add(uid);
    });
    return set;
  }, [contactUids, contactInfoQueries]);

  const items =
    tab === "contacts"
      ? friends.map((c) => ({
          key: c.uid,
          name: c.name || c.uid,
          sub: "",
          avatar: resolvePersonAvatar({
            baseURL,
            channelId: c.uid,
            spaceId,
            ...(c.avatar?.trim() && { logo: c.avatar.trim() }),
          }),
          isBot: c.isBot || botSet.has(c.uid) || channelBotSet.has(c.uid),
          onClick: () => onSelectChannel(c.uid, ChannelType.person),
        }))
      : tab === "groups"
        ? groups.map((g) => ({
            key: g.channel_id,
            name: g.name || g.channel_id,
            sub: g.member_count ? `${g.member_count} 人` : "",
            // group / topic 头像直接走 channelAvatarUrl（与 Rail/ConversationList 一致）
            avatar: channelAvatarUrl(baseURL, g.channel_id, g.channel_type),
            isBot: false,
            onClick: () => onSelectChannel(g.channel_id, g.channel_type),
          }))
        : files.map((f) => ({
            key: f.message_id,
            name: f.name || "文件",
            sub: typeof f.size === "number" ? formatBytes(f.size) : "",
            avatar: undefined as string | undefined,
            isBot: false,
            onClick: () => onOpenFile(f),
          }));

  if (!loaded && loading) {
    return <EmptyHint text="加载中…" />;
  }
  if (items.length === 0) {
    return <EmptyHint text={keyword.trim() === "" ? "暂无数据" : "无匹配结果"} />;
  }

  return <VirtualList items={items} />;
}

function VirtualList({
  items,
}: {
  items: Array<{
    key: string;
    name: string;
    sub: string;
    avatar: string | undefined;
    isBot: boolean;
    onClick: () => void;
  }>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });

  return (
    <div ref={parentRef} className="max-h-[360px] overflow-y-auto p-1.5">
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((v) => {
          const it = items[v.index];
          if (!it) return null;
          return (
            <button
              key={it.key}
              type="button"
              onClick={it.onClick}
              className="absolute top-0 left-0 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-(--color-accent)/50"
              style={{ transform: `translateY(${v.start}px)`, height: v.size }}
            >
              <Avatar className="h-8 w-8 shrink-0">
                {it.avatar && <AvatarImage src={it.avatar} alt={it.name} />}
                <AvatarFallback
                  className="text-[12.5px] font-semibold text-white"
                  style={{ background: avatarGradient(it.name || "?") }}
                >
                  {getFirstChar(it.name || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-(--color-foreground)">
                    {it.name}
                  </span>
                  {it.isBot && <AiBadge size="sm" />}
                </div>
                {it.sub && (
                  <div className="truncate text-[11.5px] text-(--color-muted-foreground)">
                    {it.sub}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="px-4 py-10 text-center text-[13px] text-(--color-muted-foreground)">{text}</div>
  );
}

function useDebouncedComposable<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
