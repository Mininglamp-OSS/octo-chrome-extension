import { useEffect } from "react";
import { useConversationViews } from "@/im/hooks/useConversationViews";
import { useCurrentChannel } from "@/stores/currentChannel";

/**
 * 对齐 mirror OctoSidepanelLayout.syncPinsAndFirstSelect：
 * 当前没有选中频道、且会话列表非空时，自动选中第一条作为 "space 默认对话"。
 * 切换 space 后 useConversationViews 会先把 conversations 清空再重新拉，
 * 因此不会误选上一个 space 的会话。
 */
export function useAutoSelectFirstConversation(): void {
  const { conversations, isLoading } = useConversationViews();
  const channelId = useCurrentChannel((s) => s.channelId);
  const hydrated = useCurrentChannel((s) => s.hydrated);
  const select = useCurrentChannel((s) => s.select);

  useEffect(() => {
    if (!hydrated) return;
    if (isLoading) return;
    if (channelId) return;
    if (conversations.length === 0) return;
    const first = conversations[0];
    if (!first) return;
    select(first.channelId, first.channelType);
  }, [hydrated, isLoading, channelId, conversations, select]);
}
