import { useEffect } from "react";
import { imReminderDone, onImMessage } from "@/im/proxy";
import { getModuleOrUnknown } from "@/messages/core/registry";
import { atMeKey, useAtMeStore } from "@/stores/atMe";
import { useAuthStore } from "@/stores/auth";
import { useCurrentChannel } from "@/stores/currentChannel";

/** 监听新消息，自动维护 @我 unread 计数；进入某 channel 时清服务端 reminder */
export function useAtMeWatcher(): void {
  const myUid = useAuthStore((s) => s.state?.uid);
  const bump = useAtMeStore((s) => s.bump);
  const clear = useAtMeStore((s) => s.clear);
  const currentId = useCurrentChannel((s) => s.channelId);
  const currentType = useCurrentChannel((s) => s.channelType);

  // 全局监听 IM 新消息 → 提及到我就 bump
  useEffect(() => {
    if (!myUid) return;
    return onImMessage((m) => {
      if (m.fromUid === myUid) return; // 自己发的不算
      const mod = getModuleOrUnknown(m.content.type);
      if (!mod.mentionable) return;
      const data = m.content.data as { mentionUids?: string[] };
      const mentions = data.mentionUids ?? [];
      if (!mentions.includes(myUid)) return;
      const k = atMeKey(m.channelId, m.channelType);
      // 如果用户当前正在看这个会话，不增
      if (currentId === m.channelId && currentType === m.channelType) return;
      bump(k);
    });
  }, [myUid, bump, currentId, currentType]);

  // 进入某个 channel → 清除本地 @我 计数 + 服务端 reminder
  useEffect(() => {
    if (!currentId) return;
    clear(atMeKey(currentId, currentType));
    void imReminderDone(currentId, currentType);
  }, [currentId, currentType, clear]);
}
