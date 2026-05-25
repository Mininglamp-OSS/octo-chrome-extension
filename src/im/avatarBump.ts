import { channelQueryKey } from "@/api/queries/channels";
import { queryClient } from "@/api/queryClient";
import type { ChannelInfo } from "@/api/schemas/channel";
import { ChannelType } from "@/const/channel";
import { parseParentGroupNo } from "@/hooks/useExpandedThreadGroups";
import { bumpAvatarTag } from "@/utils/avatar";

/**
 * 头像 cache 失效统一入口。
 *
 * 触发场景：
 *  - 收到 channelUpdate 系统消息（contentType=1005）
 *  - 本地改头像 / 改群信息 mutation 成功
 *  - 任何"我们认为头像可能变了"的强信号
 *
 * 行为：
 *  1. bumpAvatarTag —— 给 (channelId, channelType) 写入新 timestamp，
 *     之后所有 channelAvatarUrl/resolvePersonAvatar/resolveLogoUrl 拼出的 URL `?v=` 都换新
 *  2. 触发 React Query 该 channelInfo 的 subscriber 重 render —— setQueryData 浅拷贝
 *     (不发请求，只让 reference 变化)；组件 re-render 时重算 URL 自然带上新 tag
 *  3. 如果是群（channelType=group），级联通知所有子区 —— 子区 URL 是按父群 tag 拼的，
 *     父群 bump 后子区 URL 已经是新的，但子区组件不会因为父群 setQueryData re-render，
 *     得手动让子区 channelInfo subscriber 也通知一次。
 *
 * 关键顺序：必须先 bumpAvatarTag 再 setQueryData，否则组件 re-render 时 tag 还是旧的。
 */
export function bumpChannelAvatar(channelId: string, channelType: number): void {
  bumpAvatarTag(channelId, channelType);
  pokeChannelInfoSubscribers(channelId, channelType);
  if (channelType === ChannelType.group) cascadeToThreads(channelId);
}

function pokeChannelInfoSubscribers(channelId: string, channelType: number): void {
  const key = channelQueryKey(channelType, channelId);
  queryClient.setQueryData<ChannelInfo>(key, (prev) => (prev ? { ...prev } : prev));
}

function cascadeToThreads(parentGroupNo: string): void {
  const cache = queryClient.getQueryCache();
  const all = cache.findAll({ queryKey: ["channel", ChannelType.communityTopic] });
  for (const q of all) {
    const childChannelId = q.queryKey[2];
    if (typeof childChannelId !== "string") continue;
    if (parseParentGroupNo(childChannelId) !== parentGroupNo) continue;
    queryClient.setQueryData<ChannelInfo>(q.queryKey, (prev) => (prev ? { ...prev } : prev));
  }
}
