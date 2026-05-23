import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, getApiUrl } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { usePinned } from "@/api/queries/pinned";
import { type ChannelInfo, ChannelInfoSchema, isChannelInfoBot } from "@/api/schemas/channel";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ChannelType } from "@/const/channel";
import { useBotUidSet } from "@/hooks/useBotUidSet";
import type { ConversationView } from "@/im/conversation";
import { useConversationViews } from "@/im/hooks/useConversationViews";
import { atMeKey, useAtMeStore } from "@/stores/atMe";
import { useCurrentChannel } from "@/stores/currentChannel";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";
import { bumpAvatarTagIfStale } from "@/utils/avatar";
import { RailAvatar } from "./RailAvatar";
import { RailHoverCard } from "./RailHoverCard";

interface RailItem {
  channelId: string;
  channelType: number;
  name: string;
  unread: number;
  mentionCount: number;
  muted: boolean;
  logo?: string;
  isBot: boolean;
}

interface Props {
  onShowPicker?: () => void;
}

/** mirror module.ts:113 规则：remark 非空则用 remark，否则回退 name */
function resolveDisplayName(info: ChannelInfo | undefined, fallback: string): string {
  const remark = info?.remark?.trim();
  if (remark) return remark;
  const name = info?.name?.trim();
  if (name) return name;
  return fallback;
}

/**
 * 对照 mirror OctoSidepanelLayout.renderRail()（apps/extension/entrypoints/sidepanel/OctoSidepanelLayout.tsx:1246）
 * 仅渲染 pinned 项；底部 +N 显示会话总数，点击交由父层打开 picker drawer。
 *
 * 头像视觉规则收敛在 RailAvatar 组件里（见 .design/rail-pin-avatar.html）：
 *  - 真头像优先，AvatarFallback 走双字符
 *  - 子区右下加 hash 色 # 角标（同群多子区可区分）
 *  - mention 状态叠加角标而非替换主体
 */
export function VerticalRail({ onShowPicker }: Props) {
  const { conversations } = useConversationViews();
  const { data: pinnedItems } = usePinned();
  const currentId = useCurrentChannel((s) => s.channelId);
  const currentType = useCurrentChannel((s) => s.channelType);
  const select = useCurrentChannel((s) => s.select);
  const atMeCounts = useAtMeStore((s) => s.counts);
  const spaceId = useSpaceStore(selectCurrentSpaceId);
  const baseURL = getApiUrl();
  const botSet = useBotUidSet();

  // 与 mirror 一致：rail 显示名走 channelInfo.orgData.displayName（remark || name）
  // 而非 conversation.name。pinned 列表按需为每项拉一次 channelInfo。
  // staleTime=0 + refetchOnMount=always：每次 sidepanel mount 都后台 refetch，
  // 让群头像 / 名字 / logo 等改动能反映到 rail（IDB persist 仅作首屏占位，SWR 模式）。
  const channelInfoQueries = useQueries({
    queries: (pinnedItems ?? []).map((p) => ({
      queryKey: ["channel", p.channel_type, p.channel_id],
      async queryFn(): Promise<ChannelInfo> {
        const data = await api.get(Endpoints.channelInfo(p.channel_id, p.channel_type)).json();
        return ChannelInfoSchema.parse(data);
      },
      staleTime: 0,
      refetchOnMount: "always" as const,
    })),
  });

  // mount 时给每个 pin 头像 tag 限流式 bump（5 分钟内最多一次），强制 disk cache miss。
  // 即便 channelInfo.logo 字段不变（path 稳定），群多人拼图等服务端动态合成的图也能
  // 看到最新版本。bumpAvatarTagIfStale 内部限流，开关 sidepanel 不会真的每次都刷网络。
  // nonce 仅用来触发 re-render，让 RailAvatar 重新调 resolveAvatarUrl 拿到新 tag。
  const [, setTagNonce] = useState(0);
  useEffect(() => {
    if (!pinnedItems || pinnedItems.length === 0) return;
    let bumped = false;
    for (const p of pinnedItems) {
      if (bumpAvatarTagIfStale(p.channel_id, p.channel_type, 5 * 60_000)) {
        bumped = true;
      }
    }
    if (bumped) setTagNonce((n) => n + 1);
  }, [pinnedItems]);

  const { visible, hiddenCount } = useMemo(() => {
    const convMap = new Map<string, ConversationView>();
    for (const c of conversations) {
      convMap.set(`${c.channelId}:${c.channelType}`, c);
    }

    const list: RailItem[] = [];
    (pinnedItems ?? []).forEach((p, idx) => {
      const key = `${p.channel_id}:${p.channel_type}`;
      const c = convMap.get(key);
      const live = atMeCounts.get(atMeKey(p.channel_id, p.channel_type)) ?? 0;
      const info = channelInfoQueries[idx]?.data;
      const fallback = c?.name ?? p.channel_id;
      const logo = info?.logo?.trim();
      const isBot =
        p.channel_type === ChannelType.person &&
        (botSet.has(p.channel_id) || isChannelInfoBot(info));
      list.push({
        channelId: p.channel_id,
        channelType: p.channel_type,
        name: resolveDisplayName(info, fallback),
        unread: c?.unread ?? 0,
        mentionCount: Math.max(c?.mentionCount ?? 0, live),
        muted: false,
        isBot,
        ...(logo && { logo }),
      });
    });
    return { visible: list, hiddenCount: Math.max(0, conversations.length - list.length) };
    // tagNonce 不进 useMemo deps（useMemo 体内未消费）；setTagNonce 已触发整体 re-render，
    // RailAvatar 内部 resolveAvatarUrl 会在 render 时同步重新取最新 avatarTag。
  }, [conversations, pinnedItems, atMeCounts, channelInfoQueries, botSet]);

  if (visible.length === 0 && hiddenCount === 0) return null;

  return (
    <nav className="flex flex-col items-center gap-1.5 px-0 py-2.5">
      {visible.map((item) => {
        const isCurrent = item.channelId === currentId && item.channelType === currentType;
        return (
          <HoverCard key={`${item.channelId}:${item.channelType}`} openDelay={250} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  if (isCurrent) return;
                  select(item.channelId, item.channelType);
                }}
                aria-label={item.name}
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md border-none bg-transparent p-0"
              >
                <RailAvatar
                  channelId={item.channelId}
                  channelType={item.channelType}
                  name={item.name}
                  unread={item.unread}
                  mentionCount={item.mentionCount}
                  muted={item.muted}
                  active={isCurrent}
                  baseURL={baseURL}
                  spaceId={spaceId}
                  isBot={item.isBot}
                  {...(item.logo && { logo: item.logo })}
                />
              </button>
            </HoverCardTrigger>
            <HoverCardContent side="left" align="center" sideOffset={10} className="p-0">
              <RailHoverCard
                channelId={item.channelId}
                channelType={item.channelType}
                name={item.name}
                unread={item.unread}
                mentionCount={item.mentionCount}
                muted={item.muted}
                baseURL={baseURL}
                spaceId={spaceId}
                {...(item.logo && { logo: item.logo })}
              />
            </HoverCardContent>
          </HoverCard>
        );
      })}

      {hiddenCount > 0 && (
        <button
          type="button"
          title={`查看其他 ${hiddenCount} 个会话`}
          onClick={() => onShowPicker?.()}
          className="mt-1 grid h-[22px] w-8 shrink-0 cursor-pointer place-items-center rounded-md border border-(--color-border) border-dashed bg-transparent p-0 text-[10px] font-medium text-(--color-muted-foreground) transition-all duration-150 hover:border-(--color-primary) hover:bg-(--color-primary)/5 hover:text-(--color-primary)"
        >
          +{hiddenCount}
        </button>
      )}
    </nav>
  );
}
