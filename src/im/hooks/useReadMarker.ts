import { useEffect, useRef } from "react";
import { useClearUnread, useMarkMessagesRead } from "@/api/queries/channelActions";
import type { MessageView } from "@/im/message";

const READ_DEBOUNCE = 800;

/**
 * 自动已读：进入 channel 即立刻 clearUnread；之后看到新消息时按批 message/readed 上报。
 * messages 应该是按 messageSeq 升序的当前 channel 消息列表。
 */
export function useReadMarker(
  channelId: string | null,
  channelType: number,
  messages: MessageView[],
  myUid: string | undefined,
): void {
  const clearUnread = useClearUnread();
  const markRead = useMarkMessagesRead();

  const reportedRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<number | null>(null);

  // 切换 channel → 立刻 clearUnread + 重置已上报集合
  useEffect(() => {
    if (!channelId) return;
    reportedRef.current = new Set();
    clearUnread.mutate({ channelId, channelType });
  }, [channelId, channelType, clearUnread.mutate]);

  // 新消息到来时按批上报已读（仅他人发送的）
  useEffect(() => {
    if (!channelId || !myUid) return;
    const fresh: string[] = [];
    for (const m of messages) {
      if (m.fromUid === myUid) continue;
      if (reportedRef.current.has(m.messageId)) continue;
      reportedRef.current.add(m.messageId);
      fresh.push(m.messageId);
    }
    if (fresh.length === 0) return;

    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      markRead.mutate({ channelId, channelType, messageIds: fresh });
      timerRef.current = null;
    }, READ_DEBOUNCE) as unknown as number;
  }, [channelId, channelType, messages, myUid, markRead.mutate]);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);
}
