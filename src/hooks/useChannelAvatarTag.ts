import { useSyncExternalStore } from "react";
import { getEffectiveAvatarTag, subscribeAvatarTagChanges } from "@/utils/avatar";

/**
 * 订阅指定 channel 的头像 cache tag，bumpAvatarTag 后自动 re-render。
 *
 * 使用方式：
 * ```tsx
 * const tag = useChannelAvatarTag(channelId, channelType);
 * const url = useMemo(
 *   () => channelAvatarUrl(baseURL, channelId, channelType, spaceId, tag),
 *   [baseURL, channelId, channelType, spaceId, tag],
 * );
 * ```
 *
 * 子区（communityTopic）自动按父群算 tag —— 父群头像更新时子区也立刻刷新。
 *
 * 为什么不依赖 channelInfo query 的 setQueryData 触发 re-render：
 * 现在 bumpChannelAvatar 用 setQueryData 浅拷贝触发该 channel query subscriber re-render，
 * 但有些 caller 不订阅 useChannelInfo（直接接受 channelId prop 拼 URL），不会被通知。
 * 这个 hook 提供一条直接订阅 tag 变化的路径，覆盖所有场景。
 */
export function useChannelAvatarTag(channelId: string, channelType: number): string {
  return useSyncExternalStore(
    subscribeAvatarTagChanges,
    () => getEffectiveAvatarTag(channelId, channelType),
    () => getEffectiveAvatarTag(channelId, channelType),
  );
}
