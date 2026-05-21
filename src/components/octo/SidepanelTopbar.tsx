import { Check, ChevronDown, Pin, Settings as SettingsIcon } from "lucide-react";
import { useState } from "react";
import { useSpaces } from "@/api/queries/spaces";
import { useAddPinned, useRemovePinned, usePinned } from "@/api/queries/pinned";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCurrentChannel } from "@/stores/currentChannel";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";
import { cn } from "@/utils/cn";
import { SettingsPopoverContent } from "./SettingsPopoverContent";

/**
 * 顶部 topbar: [O] Octo | <space name> ▼     📌 ⚙️
 * 与 mirror wk-sidepanel-topbar 视觉对齐。
 */
export function SidepanelTopbar() {
  const currentId = useSpaceStore(selectCurrentSpaceId);
  const switchSpace = useSpaceStore((s) => s.switchSpace);
  const { data: spaces } = useSpaces();
  const [open, setOpen] = useState(false);
  const current = spaces?.find((s) => s.space_id === currentId);
  const hasMultiple = (spaces?.length ?? 0) > 1;
  const channelId = useCurrentChannel((s) => s.channelId);
  const channelType = useCurrentChannel((s) => s.channelType);
  const { data: pinnedItems } = usePinned();
  const addPin = useAddPinned();
  const removePin = useRemovePinned();
  const isPinned =
    channelId != null &&
    (pinnedItems ?? []).some(
      (p) => p.channel_id === channelId && p.channel_type === channelType,
    );

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
      {/* 左：logo + Octo + | + space name + caret */}
      <Popover open={open} onOpenChange={(o) => hasMultiple && setOpen(o)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!hasMultiple}
            className={cn(
              "flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-sm transition-colors",
              hasMultiple && "hover:bg-(--color-accent)/40",
              !hasMultiple && "cursor-default",
            )}
            title={hasMultiple ? "切换空间" : current?.name ?? "Workspace"}
          >
            <img
              src="/icon/128.png"
              alt=""
              className="h-6 w-6 shrink-0 rounded-md object-cover"
            />
            <span className="font-semibold">Octo</span>
            <span className="text-(--color-muted-foreground)/60">|</span>
            <span className="truncate text-(--color-muted-foreground)">
              {current?.name ?? "Workspace"}
            </span>
            {hasMultiple && <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <ScrollArea className="max-h-64">
            {spaces?.map((s) => (
              <button
                type="button"
                key={s.space_id}
                onClick={() => {
                  void switchSpace(s.space_id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-(--color-accent)",
                  currentId === s.space_id && "bg-(--color-accent)/60",
                )}
              >
                <span className="truncate">{s.name}</span>
                {currentId === s.space_id && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* 右：pin（chat 模式才显示）+ settings */}
      <div className="flex items-center gap-1 shrink-0">
        {channelId && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", isPinned && "text-(--color-primary)")}
            title={isPinned ? "取消固定" : "固定到 Rail"}
            onClick={() => {
              if (isPinned) {
                void removePin.mutateAsync({ channelId, channelType });
              } else {
                void addPin.mutateAsync({ channelId, channelType });
              }
            }}
          >
            <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-current")} />
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="设置"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-2">
            <SettingsPopoverContent />
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
