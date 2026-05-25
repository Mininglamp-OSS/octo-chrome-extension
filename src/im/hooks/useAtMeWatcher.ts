import { useEffect } from "react";
import { imReminderDone, onImMessage } from "@/im/proxy";
import { getModuleOrUnknown } from "@/messages/core/registry";
import { sendMessage } from "@/platform/messaging";
import { atMeCountsStorage } from "@/platform/storage";
import { atMeKey, useAtMeStore } from "@/stores/atMe";
import { useAuthStore } from "@/stores/auth";
import { useCurrentChannel } from "@/stores/currentChannel";

/** 监听新消息，自动维护 @我 unread 计数；进入某 channel 时清服务端 reminder */
export function useAtMeWatcher(): void {
  const myUid = useAuthStore((s) => s.state?.uid);
  const bump = useAtMeStore((s) => s.bump);
  const clear = useAtMeStore((s) => s.clear);
  const hydrate = useAtMeStore((s) => s.hydrate);
  const currentId = useCurrentChannel((s) => s.channelId);
  const currentType = useCurrentChannel((s) => s.channelType);

  // mount: 从 storage hydrate 内存 store + 监听 storage 变化（offscreen 期间累积的 @ 在这里灌进来）
  useEffect(() => {
    let cancelled = false;
    const toMap = (rec: Record<string, number>): Map<string, number> => {
      const m = new Map<string, number>();
      for (const [k, v] of Object.entries(rec)) {
        if (typeof v === "number" && v > 0) m.set(k, v);
      }
      return m;
    };
    void atMeCountsStorage.getValue().then((rec) => {
      if (cancelled) return;
      hydrate(toMap(rec));
    });
    const unwatch = atMeCountsStorage.watch((rec) => {
      hydrate(toMap(rec));
    });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, [hydrate]);

  // 全局监听 IM 新消息 → 提及到我就 bump（内存 + storage 双写）
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
      void sendMessage("atMeBump", {
        channelId: m.channelId,
        channelType: m.channelType,
      }).catch(() => {});
    });
  }, [myUid, bump, currentId, currentType]);

  // 进入某个 channel → 清除本地 @我 计数 + 服务端 reminder + storage
  useEffect(() => {
    if (!currentId) return;
    clear(atMeKey(currentId, currentType));
    void imReminderDone(currentId, currentType);
    void sendMessage("atMeClear", {
      channelId: currentId,
      channelType: currentType,
    }).catch(() => {});
  }, [currentId, currentType, clear]);
}
