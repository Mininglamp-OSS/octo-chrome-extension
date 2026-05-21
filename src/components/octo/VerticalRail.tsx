import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { usePinned } from "@/api/queries/pinned";
import { type ChannelInfo, ChannelInfoSchema } from "@/api/schemas/channel";
import { ChannelType } from "@/const/channel";
import type { ConversationView } from "@/im/conversation";
import { useConversationViews } from "@/im/hooks/useConversationViews";
import { atMeKey, useAtMeStore } from "@/stores/atMe";
import { useCurrentChannel } from "@/stores/currentChannel";
import { getFirstChar } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { getTitleColor } from "@/utils/titleColor";

interface RailItem {
  channelId: string;
  channelType: number;
  name: string;
  unread: number;
  mentionCount: number;
  muted: boolean;
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
 */
export function VerticalRail({ onShowPicker }: Props) {
  const { conversations } = useConversationViews();
  const { data: pinnedItems } = usePinned();
  const currentId = useCurrentChannel((s) => s.channelId);
  const currentType = useCurrentChannel((s) => s.channelType);
  const select = useCurrentChannel((s) => s.select);
  const atMeCounts = useAtMeStore((s) => s.counts);

  // 与 mirror 一致：rail 显示名走 channelInfo.orgData.displayName（remark || name）
  // 而非 conversation.name。pinned 列表按需为每项拉一次 channelInfo（TanStack Query 自动缓存去重）。
  const channelInfoQueries = useQueries({
    queries: (pinnedItems ?? []).map((p) => ({
      queryKey: ["channel", p.channel_type, p.channel_id],
      async queryFn(): Promise<ChannelInfo> {
        const data = await api
          .get(Endpoints.channelInfo(p.channel_id, p.channel_type))
          .json();
        return ChannelInfoSchema.parse(data);
      },
      staleTime: 5 * 60_000,
    })),
  });

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
      list.push({
        channelId: p.channel_id,
        channelType: p.channel_type,
        name: resolveDisplayName(info, fallback),
        unread: c?.unread ?? 0,
        mentionCount: Math.max(c?.mentionCount ?? 0, live),
        muted: false,
      });
    });
    return { visible: list, hiddenCount: Math.max(0, conversations.length - list.length) };
  }, [conversations, pinnedItems, atMeCounts, channelInfoQueries]);

  if (visible.length === 0 && hiddenCount === 0) return null;

  return (
    <nav className="flex flex-col items-center gap-1 px-0 py-2.5">
      {visible.map((item) => {
        const isCurrent = item.channelId === currentId && item.channelType === currentType;
        const isPrivate = item.channelType === ChannelType.person;
        const hasMention = item.mentionCount > 0;
        const hasUnread = item.unread > 0 && !hasMention;
        const railItemBackground = getTitleColor(item.name);

        return (
          <button
            key={`${item.channelId}:${item.channelType}`}
            type="button"
            title={item.name}
            onClick={() => {
              if (isCurrent) return;
              select(item.channelId, item.channelType);
            }}
            className={cn(
              "relative grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md border-none bg-transparent p-0 transition-all duration-150",
              item.muted && "[&_.rail-icon]:opacity-55",
            )}
          >
            {hasMention ? (
              <span
                className={cn(
                  "rail-icon grid h-full w-full select-none place-items-center rounded-md text-[18px] font-bold leading-none tracking-tight text-white",
                )}
                style={{
                  background: "#F97316",
                  boxShadow: "0 2px 6px rgba(249, 115, 22, 0.4)",
                }}
              >
                @
              </span>
            ) : isPrivate ? (
              <span
                className="rail-icon grid h-[26px] w-[26px] select-none place-items-center rounded-full text-[13px] font-semibold leading-none text-white"
                style={{ background: railItemBackground }}
              >
                {getFirstChar(item.name)}
              </span>
            ) : (
              <span
                className="rail-icon grid h-full w-full select-none place-items-center rounded-md text-[15px] font-medium leading-none text-white"
                style={{ background: railItemBackground }}
              >
                {getFirstChar(item.name)}
              </span>
            )}

            {/* 未读小红点 */}
            {hasUnread && (
              <span
                className={cn(
                  "absolute right-px top-px h-[7px] w-[7px] rounded-full border-[1.5px] border-(--color-background)",
                  item.muted
                    ? "bg-(--color-muted-foreground)/60"
                    : "bg-[#F54A45] shadow-[0_0_0_0.5px_rgba(245,74,69,0.4)]",
                )}
              />
            )}
          </button>
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
