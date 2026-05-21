import { Check, ChevronDown, FolderCog, Layers } from "lucide-react";
import { useState } from "react";
import { useSpaces } from "@/api/queries/spaces";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCategoriesUi } from "@/stores/categoriesUi";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";
import { cn } from "@/utils/cn";

export function SpaceSwitcher() {
  const currentId = useSpaceStore(selectCurrentSpaceId);
  const switchSpace = useSpaceStore((s) => s.switchSpace);
  const { data: spaces, isLoading } = useSpaces();
  const openManage = useCategoriesUi((s) => s.openManage);
  const [open, setOpen] = useState(false);

  const current = spaces?.find((s) => s.space_id === currentId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-sm">
          <Layers className="h-3.5 w-3.5" />
          <span className="truncate max-w-[120px]">
            {current?.name ?? (currentId ? currentId : "选择 Space")}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <ScrollArea className="max-h-64">
          {isLoading && (
            <div className="px-3 py-2 text-xs text-(--color-muted-foreground)">加载中…</div>
          )}
          {!isLoading && (!spaces || spaces.length === 0) && (
            <div className="px-3 py-2 text-xs text-(--color-muted-foreground)">暂无 Space</div>
          )}
          <button
            type="button"
            onClick={() => void switchSpace(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-(--color-accent)",
              currentId === null && "bg-(--color-accent)/60",
            )}
          >
            <span>全部</span>
            {currentId === null && <Check className="h-3.5 w-3.5" />}
          </button>
          {spaces?.map((s) => (
            <button
              type="button"
              key={s.space_id}
              onClick={() => void switchSpace(s.space_id)}
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
        {currentId !== null && (
          <>
            <div className="my-1 h-px bg-(--color-border)" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openManage();
              }}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-(--color-accent)"
            >
              <FolderCog className="h-3.5 w-3.5 text-(--color-muted-foreground)" />
              <span>管理分组…</span>
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
