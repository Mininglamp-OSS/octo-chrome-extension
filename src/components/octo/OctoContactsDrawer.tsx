import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useFriends, useMyBots } from "@/api/queries/contacts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChannelType } from "@/const/channel";
import { useCurrentChannel } from "@/stores/currentChannel";
import { useDrawerStore } from "@/stores/drawer";
import { avatarGradient, getFirstChar } from "@/utils/avatar";

export function OctoContactsDrawer() {
  const open = useDrawerStore((s) => s.contacts);
  const close = useDrawerStore((s) => s.closeContacts);
  const select = useCurrentChannel((s) => s.select);
  const [kw, setKw] = useState("");

  const { data: friends, isLoading: lf } = useFriends();
  const { data: bots, isLoading: lb } = useMyBots();

  const filteredFriends = useMemo(() => {
    const list = friends ?? [];
    const k = kw.trim().toLowerCase();
    if (!k) return list;
    return list.filter((f) => f.name.toLowerCase().includes(k) || f.uid.toLowerCase().includes(k));
  }, [friends, kw]);

  const filteredBots = useMemo(() => {
    const list = bots ?? [];
    const k = kw.trim().toLowerCase();
    if (!k) return list;
    return list.filter((b) => b.name.toLowerCase().includes(k) || b.uid.toLowerCase().includes(k));
  }, [bots, kw]);

  function openDM(uid: string): void {
    select(uid, ChannelType.person);
    close();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="left" className="flex w-full max-w-sm flex-col p-0">
        <SheetHeader className="border-b px-4 pb-3 pt-4">
          <SheetTitle className="text-sm">通讯录</SheetTitle>
          <SheetDescription className="sr-only">浏览联系人 + 开私聊</SheetDescription>
          <div className="relative pt-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--color-muted-foreground)" />
            <Input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索…"
              className="pl-7"
            />
          </div>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {filteredBots.length > 0 && (
            <Section title="AI 伙伴">
              {filteredBots.map((b) => (
                <Row
                  key={b.uid}
                  uid={b.uid}
                  name={b.name}
                  desc={b.description ?? ""}
                  avatar={b.avatar}
                  onClick={() => openDM(b.uid)}
                />
              ))}
            </Section>
          )}
          {filteredFriends.length > 0 && (
            <Section title="联系人">
              {filteredFriends.map((f) => (
                <Row
                  key={f.uid}
                  uid={f.uid}
                  name={f.name}
                  desc={f.remark}
                  avatar={f.avatar}
                  onClick={() => openDM(f.uid)}
                />
              ))}
            </Section>
          )}
          {(lf || lb) && (
            <p className="px-4 py-6 text-center text-xs text-(--color-muted-foreground)">
              加载中…
            </p>
          )}
          {!lf && !lb && filteredFriends.length === 0 && filteredBots.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-(--color-muted-foreground)">
              {kw ? "无匹配" : "暂无联系人"}
            </p>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-2">
      <p className="px-2 py-1 text-[11px] font-medium text-(--color-muted-foreground)">{title}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({
  uid,
  name,
  desc,
  avatar,
  onClick,
}: {
  uid: string;
  name: string;
  desc: string;
  avatar?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-(--color-accent)/40"
    >
      <Avatar className="h-9 w-9 shrink-0">
        {avatar && <AvatarImage src={avatar} alt={name} />}
        <AvatarFallback
          className="text-xs text-white"
          style={{ background: avatarGradient(name) }}
        >
          {getFirstChar(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-[11px] text-(--color-muted-foreground)">{desc || uid}</p>
      </div>
    </button>
  );
}
