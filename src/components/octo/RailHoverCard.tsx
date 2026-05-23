import { BellOff, ChevronRight } from "lucide-react";
import { useChannelInfo } from "@/api/queries/channels";
import { isChannelInfoBot } from "@/api/schemas/channel";
import { AiBadge } from "@/components/octo/AiBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChannelType } from "@/const/channel";
import { useBotUidSet } from "@/hooks/useBotUidSet";
import { parseParentGroupNo } from "@/hooks/useExpandedThreadGroups";
import {
  channelAvatarUrl,
  getInitials,
  resolveImageURL,
  resolvePersonAvatar,
} from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { getThreadHueColor, getTitleColor } from "@/utils/titleColor";

interface RailHoverCardProps {
  channelId: string;
  channelType: number;
  name: string;
  unread: number;
  mentionCount: number;
  muted: boolean;
  baseURL: string;
  spaceId?: string | null;
  logo?: string;
}

/**
 * Rail item hover 浮出的信息卡片（对照 .design/rail-hover-tooltip.html + rail-thread-card.html）。
 *
 *  - 私聊/群聊：36px Avatar + name + 类型 chip + muted 图标 + 未读/@ pill
 *  - 子区：单独走 ThreadHoverBody —— 顶部 inline crumb pill（父群）+ 主体 40px hash 色 # 色块（不复用父群头像）
 *  - 纯只读，不放可点击操作（避免 hover→click 闪烁）
 *  - 不展示最近消息预览 / 时间 —— 高频信息走 ConversationList，hover 只解决「我是谁」
 */
export function RailHoverCard({
  channelId,
  channelType,
  name,
  unread,
  mentionCount,
  muted,
  baseURL,
  spaceId,
  logo,
}: RailHoverCardProps) {
  const isThread = channelType === ChannelType.communityTopic;

  if (isThread) {
    return (
      <ThreadHoverBody
        channelId={channelId}
        name={name}
        unread={unread}
        mentionCount={mentionCount}
        muted={muted}
        baseURL={baseURL}
        spaceId={spaceId ?? null}
      />
    );
  }

  return (
    <ChannelHoverBody
      channelId={channelId}
      channelType={channelType}
      name={name}
      unread={unread}
      mentionCount={mentionCount}
      muted={muted}
      baseURL={baseURL}
      spaceId={spaceId ?? null}
      {...(logo && { logo })}
    />
  );
}

// ====================================================================
// 子区：crumb + # 色块主体（B 方案）
// ====================================================================
function ThreadHoverBody({
  channelId,
  name,
  unread,
  mentionCount,
  muted,
  baseURL,
  spaceId,
}: {
  channelId: string;
  name: string;
  unread: number;
  mentionCount: number;
  muted: boolean;
  baseURL: string;
  spaceId: string | null;
}) {
  const parentGroupNo = parseParentGroupNo(channelId);
  const parentQuery = useChannelInfo(parentGroupNo, ChannelType.group);
  const parentInfo = parentQuery.data;
  const parentName = parentInfo?.remark?.trim() || parentInfo?.name?.trim() || parentGroupNo || "";
  const parentAvatarUrl = parentGroupNo
    ? channelAvatarUrl(baseURL, parentGroupNo, ChannelType.group, spaceId)
    : "";

  const hue = getThreadHueColor(name);
  const showUnreadPill = unread > 0 && mentionCount === 0;
  const showMentionPill = mentionCount > 0;

  return (
    <div className="select-none px-3.5 py-3">
      {parentGroupNo && (
        <div
          className="mb-2.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-(--color-primary)/15 bg-(--color-primary)/8 py-0.5 pr-2 pl-1 text-[11px] text-(--color-muted-foreground)"
          title={parentName}
        >
          <span className="grid h-[14px] w-[14px] shrink-0 place-items-center overflow-hidden rounded-full">
            {parentAvatarUrl ? (
              <img src={parentAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span
                className="grid h-full w-full place-items-center text-[7px] font-bold text-white"
                style={{ background: getTitleColor(parentName || "?") }}
              >
                {getInitials(parentName || "?", 1)}
              </span>
            )}
          </span>
          <span className="min-w-0 truncate font-semibold text-(--color-foreground)">
            {parentName || "加载中…"}
          </span>
          <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        </div>
      )}

      <div className="grid grid-cols-[40px_1fr] items-center gap-3.5">
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-[10px] text-[22px] font-extrabold leading-none text-white",
            muted && "opacity-55",
          )}
          style={{
            background: hue,
            boxShadow: muted ? "none" : `0 2px 8px ${hue}59`,
          }}
          aria-hidden
        >
          #
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "truncate text-[16px] font-bold leading-[1.2] tracking-[-0.012em]",
              muted && "opacity-70",
            )}
            title={name}
          >
            {name}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-(--color-muted-foreground)">
            <span className="rounded-[4px] bg-(--color-primary)/15 px-1.5 py-px font-mono text-[10px] font-semibold text-(--color-primary)">
              子区
            </span>
            {muted && <BellOff className="h-3 w-3" aria-label="已静音" />}
            {showMentionPill && (
              <span className="inline-flex items-center rounded-full bg-[#F97316]/15 px-1.5 py-px text-[10px] font-bold text-[#F97316]">
                @ {mentionCount > 99 ? "99+" : mentionCount}
              </span>
            )}
            {showUnreadPill && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-bold",
                  muted
                    ? "bg-(--color-muted) text-(--color-muted-foreground)"
                    : "bg-[#F54A45]/12 text-[#F54A45]",
                )}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// 私聊 / 群聊：标准头像 + name + chip
// ====================================================================
function ChannelHoverBody({
  channelId,
  channelType,
  name,
  unread,
  mentionCount,
  muted,
  baseURL,
  spaceId,
  logo,
}: {
  channelId: string;
  channelType: number;
  name: string;
  unread: number;
  mentionCount: number;
  muted: boolean;
  baseURL: string;
  spaceId: string | null;
  logo?: string;
}) {
  const isPrivate = channelType === ChannelType.person;
  const botSet = useBotUidSet();
  const { data: personInfo } = useChannelInfo(
    isPrivate ? channelId : null,
    ChannelType.person,
  );
  const isBot = isPrivate && (botSet.has(channelId) || isChannelInfoBot(personInfo));
  const avatarUrl = resolveAvatarUrl({ baseURL, channelId, channelType, spaceId, logo });
  const initials = getInitials(name);
  const fallbackBg = getTitleColor(name);
  const kindLabel = isPrivate ? "私聊" : "群聊";
  const showUnreadPill = unread > 0 && mentionCount === 0;
  const showMentionPill = mentionCount > 0;

  return (
    <div className="select-none">
      <div className="grid grid-cols-[36px_1fr] items-center gap-2.5 px-3.5 py-3">
        <Avatar
          className={cn("h-9 w-9 overflow-hidden", isPrivate ? "rounded-full" : "rounded-md")}
        >
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name} className="object-cover" />}
          <AvatarFallback
            className={cn(
              "font-semibold text-white",
              initials.length >= 2 ? "text-[12px]" : "text-[14px]",
              isPrivate ? "rounded-full" : "rounded-md",
            )}
            style={{ background: fallbackBg }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className="truncate text-[14px] font-semibold leading-tight tracking-[-0.01em]"
              title={name}
            >
              {name}
            </span>
            {isBot && <AiBadge size="sm" />}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-(--color-muted-foreground)">
            <span className="rounded-[4px] bg-(--color-muted) px-1.5 py-px font-mono text-[10px] font-semibold text-(--color-foreground)/70">
              {kindLabel}
            </span>
            {muted && <BellOff className="h-3 w-3" aria-label="已静音" />}
            {showMentionPill && (
              <span className="inline-flex items-center rounded-full bg-[#F97316]/15 px-1.5 py-px text-[10px] font-bold text-[#F97316]">
                @ {mentionCount > 99 ? "99+" : mentionCount}
              </span>
            )}
            {showUnreadPill && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-bold",
                  muted
                    ? "bg-(--color-muted) text-(--color-muted-foreground)"
                    : "bg-[#F54A45]/12 text-[#F54A45]",
                )}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveAvatarUrl(opts: {
  baseURL: string;
  channelId: string;
  channelType: number;
  spaceId: string | null;
  logo?: string;
}): string {
  const { baseURL, channelId, channelType, spaceId, logo } = opts;
  if (!baseURL || !channelId) return "";
  if (channelType === ChannelType.person || channelType === ChannelType.customerService) {
    const cleanLogo = logo?.trim();
    return resolvePersonAvatar({
      baseURL,
      channelId,
      spaceId,
      ...(cleanLogo && { logo: cleanLogo }),
    });
  }
  const cleanLogo = logo?.trim();
  if (cleanLogo) return resolveImageURL(baseURL, cleanLogo);
  return channelAvatarUrl(baseURL, channelId, channelType, spaceId);
}
