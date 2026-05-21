import { FileIcon, Hash, MessageSquare, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useGlobalSearch } from "@/api/queries/search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChannelType } from "@/const/channel";
import { useCurrentChannel } from "@/stores/currentChannel";
import { useUIStore } from "@/stores/ui";
import { avatarGradient, getFirstChar } from "@/utils/avatar";
import { formatConversationTime } from "@/utils/time";

type Tab = "contacts" | "groups" | "files" | "messages";

export function SearchPopover() {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [tab, setTab] = useState<Tab>("contacts");
  const select = useCurrentChannel((s) => s.select);
  const openLightbox = useUIStore((s) => s.openLightbox);

  const debouncedKw = useDebounced(keyword, 250);
  const { data, isFetching } = useGlobalSearch(debouncedKw);

  function go(channelId: string, channelType: number): void {
    select(channelId, channelType);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setKeyword("");
          setTab("contacts");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Search className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-2 py-1.5">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索联系人 / 群 / 文件 / 消息…"
            className="h-8"
            ref={(el) => el?.focus()}
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="border-b px-2 py-1">
          <TabsList className="h-7 w-full justify-start gap-0">
            <TabsTrigger value="contacts" className="px-2 text-[11px]">
              <Users className="mr-1 h-3 w-3" /> 联系人 {countOf(data?.friends)}
            </TabsTrigger>
            <TabsTrigger value="groups" className="px-2 text-[11px]">
              <Hash className="mr-1 h-3 w-3" /> 群 {countOf(data?.groups)}
            </TabsTrigger>
            <TabsTrigger value="files" className="px-2 text-[11px]">
              <FileIcon className="mr-1 h-3 w-3" /> 文件 {countOf(data?.files)}
            </TabsTrigger>
            <TabsTrigger value="messages" className="px-2 text-[11px]">
              <MessageSquare className="mr-1 h-3 w-3" /> 消息 {countOf(data?.messages)}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="contacts" className="m-0">
            <ResultList loading={isFetching} empty="无匹配联系人">
              {(data?.friends ?? []).map((c) => (
                <ResultRow
                  key={c.uid}
                  name={c.name}
                  desc={c.uid}
                  avatar={c.avatar}
                  onClick={() => go(c.uid, ChannelType.person)}
                />
              ))}
            </ResultList>
          </TabsContent>
          <TabsContent value="groups" className="m-0">
            <ResultList loading={isFetching} empty="无匹配群聊">
              {(data?.groups ?? []).map((g) => (
                <ResultRow
                  key={g.channel_id}
                  name={g.name}
                  desc={g.channel_id}
                  avatar={g.avatar}
                  onClick={() => go(g.channel_id, g.channel_type)}
                />
              ))}
            </ResultList>
          </TabsContent>
          <TabsContent value="files" className="m-0">
            <ResultList loading={isFetching} empty="无匹配文件">
              {(data?.files ?? []).map((f) => (
                <button
                  key={f.message_id}
                  type="button"
                  onClick={() => {
                    if (/\.(png|jpe?g|gif|webp)$/i.test(f.name)) {
                      openLightbox({ url: f.url, name: f.name });
                    } else {
                      window.open(f.url, "_blank");
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-(--color-accent)/40"
                >
                  <FileIcon className="h-4 w-4 text-(--color-muted-foreground)" />
                  <span className="truncate text-sm">{f.name}</span>
                </button>
              ))}
            </ResultList>
          </TabsContent>
          <TabsContent value="messages" className="m-0">
            <ResultList loading={isFetching} empty="无匹配消息">
              {(data?.messages ?? []).map((m) => (
                <button
                  key={m.message_id}
                  type="button"
                  onClick={() => go(m.channel_id, m.channel_type)}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-(--color-accent)/40"
                >
                  <p className="truncate text-xs text-(--color-muted-foreground)">
                    {m.from_uid} ·{" "}
                    {m.timestamp ? formatConversationTime(m.timestamp * 1000) : ""}
                  </p>
                  <p className="line-clamp-2 text-sm">{m.text}</p>
                </button>
              ))}
            </ResultList>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function ResultList({
  loading,
  empty,
  children,
}: {
  loading: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  const empty_ = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <ScrollArea className="max-h-72">
      {loading && (
        <p className="px-3 py-4 text-center text-xs text-(--color-muted-foreground)">搜索中…</p>
      )}
      {!loading && empty_ && (
        <p className="px-3 py-4 text-center text-xs text-(--color-muted-foreground)">{empty}</p>
      )}
      {!empty_ && <div className="flex flex-col">{children}</div>}
    </ScrollArea>
  );
}

function ResultRow({
  name,
  desc,
  avatar,
  onClick,
}: {
  name: string;
  desc?: string;
  avatar?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-(--color-accent)/40"
    >
      <Avatar className="h-7 w-7 shrink-0">
        {avatar && <AvatarImage src={avatar} alt={name} />}
        <AvatarFallback
          className="text-[10px] text-white"
          style={{ background: avatarGradient(name) }}
        >
          {getFirstChar(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{name}</p>
        {desc && <p className="truncate text-[11px] text-(--color-muted-foreground)">{desc}</p>}
      </div>
    </button>
  );
}

function countOf<T>(arr: T[] | undefined): string {
  const n = arr?.length ?? 0;
  return n > 0 ? `(${n})` : "";
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
