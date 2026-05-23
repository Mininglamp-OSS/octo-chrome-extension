import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { api, getApiUrl } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { ChannelInfoSchema } from "@/api/schemas/channel";
import { isMemberBot, type Member } from "@/api/schemas/member";
import { ChannelType } from "@/const/channel";
import { useSpaceStore } from "@/stores/space";
import { resolvePersonAvatar } from "@/utils/avatar";

/** 判定 bot 所需的最小字段子集；兼容 Member / SpaceMember / Bot 等不同来源。 */
type BotCandidate = Pick<Member, "uid"> &
  Partial<Pick<Member, "category" | "robot" | "bot_type" | "org_data">>;

/**
 * 给一组成员，把里面的 bot 单独按 uid 拉 person channelInfo，从 logo 拼真实头像 URL。
 *
 * 为什么 bot 要单独拉：group `/members` 接口对 bot 不返 logo，IM 通用的 `users/{uid}/avatar`
 * 路径对 bot uid 也是 404 / fallback。bot 头像唯一可靠数据源是 person `channelInfo.logo`。
 *
 * 共享：queryKey `["channel", person, uid]` 与 useChannelInfo / MessageList / cmdk picker 一致，
 * React Query cache 自动复用；providers.tsx 已 persist 到 IDB → 跨 entrypoint + 跨刷新共享。
 */
export function useBotAvatarMap(members: BotCandidate[] | undefined): Map<string, string> {
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  const botUids = useMemo(
    () => (members ?? []).filter(isMemberBot).map((m) => m.uid),
    [members],
  );
  const queries = useQueries({
    queries: botUids.map((uid) => ({
      queryKey: ["channel", ChannelType.person, uid] as const,
      enabled: Boolean(uid),
      staleTime: 5 * 60_000,
      async queryFn() {
        const data = await api.get(Endpoints.channelInfo(uid, ChannelType.person)).json();
        return ChannelInfoSchema.parse(data);
      },
    })),
  });
  const logosKey = queries.map((q) => q.data?.logo ?? "").join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖 queries 数据快照，已通过 logosKey 内容化
  return useMemo(() => {
    const base = getApiUrl();
    const m = new Map<string, string>();
    botUids.forEach((uid, i) => {
      const logo = queries[i]?.data?.logo?.trim();
      if (!logo) return;
      const url = resolvePersonAvatar({ baseURL: base, channelId: uid, spaceId, logo });
      if (url) m.set(uid, url);
    });
    return m;
  }, [botUids, spaceId, logosKey]);
}
