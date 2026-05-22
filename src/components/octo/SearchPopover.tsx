import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { useFriends } from "@/api/queries/contacts";
import { type SearchResult, SearchResultSchema } from "@/api/schemas/search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChannelType } from "@/const/channel";
import { useCurrentChannel } from "@/stores/currentChannel";
import { useSpaceStore } from "@/stores/space";
import { useUIStore } from "@/stores/ui";
import { avatarGradient, getFirstChar } from "@/utils/avatar";
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

  // 默认（空 kw）联系人来自 friend/sync 全量；搜索（非空 kw）联系人/群/文件全部来自 /search/global
  const { data: friendsData } = useFriends();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["sidepanel-search", spaceId, debouncedKw.trim()],
    enabled: open,
    staleTime: 15_000,
    async queryFn(): Promise<SearchResult> {
      const searchParams: Record<string, string> = { keyword: debouncedKw.trim() };
      if (spaceId) searchParams.space_id = spaceId;
      const raw = await api.get(Endpoints.searchGlobal, { searchParams }).json();
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

  // 默认态联系人用 friend/sync（mirror 风格的 4171 全量），最多 50 条避免渲染卡顿；
  // 群组始终来自 search（空 kw 让后端兜底，没数据就空）；文件空 kw 直接空。
  const defaultFriends = (friendsData ?? []).slice(0, 50).map((f) => ({
    uid: f.uid,
    name: f.remark || f.name,
    avatar: f.avatar,
  }));
  const friends = isDefault
    ? defaultFriends
    : (data?.friends ?? []).map((f) => ({ uid: f.uid, name: f.name, avatar: f.avatar }));
  const groups = data?.groups ?? [];
  const files = isDefault ? [] : (data?.files ?? []);
  const counts: Record<Tab, number> = {
    contacts: isDefault ? (friendsData?.length ?? 0) : friends.length,
    groups: groups.length,
    files: isDefault ? 0 : files.length,
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
  friends: { uid: string; name: string; avatar?: string }[];
  groups: SearchResult["groups"];
  files: SearchResult["files"];
  onSelectChannel: (channelId: string, channelType: number) => void;
  onOpenFile: (f: SearchResult["files"][number]) => void;
}) {
  const items =
    tab === "contacts"
      ? friends.map((c) => ({
          key: c.uid,
          name: c.name || c.uid,
          sub: "",
          avatar: c.avatar,
          onClick: () => onSelectChannel(c.uid, ChannelType.person),
        }))
      : tab === "groups"
        ? groups.map((g) => ({
            key: g.channel_id,
            name: g.name || g.channel_id,
            sub: "",
            avatar: g.avatar,
            onClick: () => onSelectChannel(g.channel_id, g.channel_type),
          }))
        : files.map((f) => ({
            key: f.message_id,
            name: f.name || "文件",
            sub: typeof f.size === "number" ? formatBytes(f.size) : "",
            avatar: undefined as string | undefined,
            onClick: () => onOpenFile(f),
          }));

  if (!loaded && loading) {
    return <EmptyHint text="加载中…" />;
  }
  // 文件 Tab 在空 keyword 时不展示「暂无数据」，而是引导用户输入关键字
  if (items.length === 0 && tab === "files" && keyword.trim() === "") {
    return <EmptyHint text="输入关键字搜索文件" />;
  }
  if (items.length === 0) {
    return <EmptyHint text={keyword.trim() === "" ? "暂无数据" : "无匹配结果"} />;
  }

  return (
    <div className="max-h-[360px] overflow-y-auto p-1.5">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={it.onClick}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-(--color-accent)/50"
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
            <div className="truncate text-[13px] font-medium text-(--color-foreground)">
              {it.name}
            </div>
            {it.sub && (
              <div className="truncate text-[11.5px] text-(--color-muted-foreground)">{it.sub}</div>
            )}
          </div>
        </button>
      ))}
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
