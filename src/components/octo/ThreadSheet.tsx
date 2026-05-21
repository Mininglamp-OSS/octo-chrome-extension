import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useChannelMessages } from "@/im/hooks/useChannelMessages";
import { useThreadStore } from "@/stores/thread";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

export function ThreadSheet() {
  const current = useThreadStore((s) => s.current);
  const close = useThreadStore((s) => s.close);

  const channelId = current?.channelId ?? null;
  const channelType = current?.channelType ?? 0;
  const { messages, loading, loadingMore, hasMore, error, loadMore } = useChannelMessages(
    channelId,
    channelType,
  );

  return (
    <Sheet open={current != null} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm font-semibold">子区</SheetTitle>
          {current && (
            <p className="truncate text-xs text-(--color-muted-foreground)">
              回复：{current.parentDigest}
            </p>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1">
          {!current && null}
          {current && loading && (
            <div className="flex h-full items-center justify-center text-sm text-(--color-muted-foreground)">
              加载历史…
            </div>
          )}
          {current && !loading && error && (
            <div className="flex h-full items-center justify-center p-6 text-sm text-(--color-destructive)">
              {error.message}
            </div>
          )}
          {current && !loading && !error && (
            <MessageList
              messages={messages}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={() => void loadMore()}
            />
          )}
        </div>

        {current && (
          <Composer channelId={current.channelId} channelType={current.channelType} />
        )}
      </SheetContent>
    </Sheet>
  );
}
