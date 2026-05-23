import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { type ChannelInfo, ChannelInfoSchema } from "../schemas/channel";

/**
 * 全项目 channelInfo 查询的统一配置。
 *
 * 设计目标：
 *  - **每次 sidepanel 重新打开（页面重 mount）必拉新**：staleTime: 0 + refetchOnMount: "always"，
 *    保证用户看到的头像 / 名字 / remark 是最新（即使 IDB 里 persist 的是旧数据）。
 *  - **不闪白屏**：保留 IDB persist（providers.tsx 里 `channel` 进 dehydrate 白名单），
 *    hydrate 出旧数据先渲染兜底，refetch 完成静默替换 → SWR 模式。
 *  - **不在 window focus 时反复拉**：refetchOnWindowFocus 全局已关闭。
 *  - **运行时 SDK 推 channelInfo update**：im/client.ts 的 ChannelInfoListener
 *    会 setQueryData 写进同一 key，配合 bumpAvatarTag 让头像 URL 也失效。
 */
const CHANNEL_QUERY_BASE = {
  staleTime: 0,
  refetchOnMount: "always" as const,
};

export function channelQueryKey(channelType: number, channelId: string) {
  return ["channel", channelType, channelId] as const;
}

async function fetchChannelInfo(channelId: string, channelType: number): Promise<ChannelInfo> {
  const data = await api.get(Endpoints.channelInfo(channelId, channelType)).json();
  return ChannelInfoSchema.parse(data);
}

export function useChannelInfo(channelId: string | null, channelType: number) {
  const id = channelId ?? "";
  return useQuery({
    queryKey: channelQueryKey(channelType, id),
    enabled: Boolean(channelId),
    queryFn: () => fetchChannelInfo(id, channelType),
    ...CHANNEL_QUERY_BASE,
  });
}

/**
 * 批量取多个 channel 的 info。返回结果数组与 items 同序，
 * 每项是 React Query 的 UseQueryResult<ChannelInfo>，调用方自行取 .data。
 *
 * items 中传 null 或空 channelId 的项会被禁用（enabled: false），方便按需过滤。
 */
export function useChannelInfos(items: { channelId: string; channelType: number }[]) {
  return useQueries({
    queries: items.map((it) => ({
      queryKey: channelQueryKey(it.channelType, it.channelId),
      enabled: Boolean(it.channelId),
      queryFn: () => fetchChannelInfo(it.channelId, it.channelType),
      ...CHANNEL_QUERY_BASE,
    })),
  });
}
