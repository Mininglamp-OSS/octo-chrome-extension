import { Loader2 } from "lucide-react";
import { useChannelInfo } from "@/api/queries/channels";
import { useChannelMembers } from "@/api/queries/members";
import { ChannelType } from "@/const/channel";
import { useChannelMessages } from "@/im/hooks/useChannelMessages";
import { useReadMarker } from "@/im/hooks/useReadMarker";
import { useAuthStore } from "@/stores/auth";
import { useCurrentChannel } from "@/stores/currentChannel";
import { useDrawerStore } from "@/stores/drawer";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { SearchPopover } from "./SearchPopover";

export function Conversation() {
  const channelId = useCurrentChannel((s) => s.channelId);
  const channelType = useCurrentChannel((s) => s.channelType);
  const myUid = useAuthStore((s) => s.state?.uid);
  const openInfo = useDrawerStore((s) => s.openInfo);
  const { data: info } = useChannelInfo(channelId, channelType);
  const isGroup = channelType === ChannelType.group;
  const { data: members } = useChannelMembers({
    channelId: isGroup ? channelId : null,
    limit: 1000,
  });
  const memberCount = isGroup ? (members?.length ?? 0) : 0;
  const { messages, loading, loadingMore, hasMore, error, loadMore } = useChannelMessages(
    channelId,
    channelType,
  );

  useReadMarker(channelId, channelType, messages, myUid);

  if (!channelId) return null;

  const title = info?.name ?? channelId;

  return (
    <div className="flex h-full flex-col">
      {/* chat header: 群名 + 搜索 + 共 N 人。切换频道走 picker drawer，与 mirror 一致，无返回按钮 */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2">
        <button
          type="button"
          onClick={openInfo}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
        >
          {title}
        </button>
        <SearchPopover />
        {isGroup && memberCount > 0 && (
          <button
            type="button"
            onClick={openInfo}
            className="shrink-0 rounded-full bg-(--color-muted)/40 px-2 py-0.5 text-[11px] text-(--color-muted-foreground) hover:bg-(--color-muted)/60"
          >
            共 <span className="font-semibold">{memberCount}</span> 人
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-(--color-muted-foreground)" />
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full items-center justify-center p-6 text-sm text-(--color-destructive)">
            {error.message}
          </div>
        )}
        {!loading && !error && (
          <MessageList
            messages={messages}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={() => void loadMore()}
          />
        )}
      </div>

      <Composer
        channelId={channelId}
        channelType={channelType}
        members={members?.filter((m) => m.uid !== myUid)}
        messages={messages}
        {...(channelType === ChannelType.person && info
          ? { peer: { uid: channelId, name: info.name ?? channelId } as never }
          : {})}
      />
    </div>
  );
}
