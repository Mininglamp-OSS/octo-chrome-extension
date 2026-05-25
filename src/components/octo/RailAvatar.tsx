import { Headphones, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChannelType } from "@/const/channel";
import { useChannelAvatarTag } from "@/hooks/useChannelAvatarTag";
import { channelAvatarUrl, getInitials, resolveLogoUrl, resolvePersonAvatar } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { getThreadHueColor, getTitleColor } from "@/utils/titleColor";

interface RailAvatarProps {
  channelId: string;
  channelType: number;
  name: string;
  unread: number;
  mentionCount: number;
  muted: boolean;
  active: boolean;
  baseURL: string;
  spaceId?: string | null;
  /** channelInfo.logo 优先于推算 URL */
  logo?: string;
  /** 私聊场景下，channelId 是否为 AI bot —— 由调用方反查 botSet/channelInfo 后传入 */
  isBot?: boolean;
}

/**
 * Rail 上的 pin item 头像（对齐 mirror OctoSidepanelLayout）。
 *
 * 视觉规则：
 *  - **@me 时整个槽位替换成大橙色 @ 方块**（pulse 动画），不再保留头像辨识 ——
 *    mirror 行为，让被 @ 的会话最显眼
 *  - 否则走原头像 + 类型角标（子区 # / 群 Users / 客服 Headphones / AI）
 *  - 真头像优先 → fallback getInitials（双字符/词首缩写/emoji）
 *  - 未激活：极淡 ring（黑 8% / 暗色白 10%）
 *  - 激活：ring-2 indigo
 *  - **未读 badge：右上数字胶囊**（min-width 17px，圆角 100px，#F54A45 红底白字，
 *    双 ring 贴纸效果），>99 显示 99+；mention 时也展示在 @ 方块右上
 *  - 免打扰：整体 opacity 0.55，未读 badge 变灰
 */
export function RailAvatar({
  channelId,
  channelType,
  name,
  unread,
  mentionCount,
  muted,
  active,
  baseURL,
  spaceId,
  logo,
  isBot,
}: RailAvatarProps) {
  const isPrivate = channelType === ChannelType.person;
  const isThread = channelType === ChannelType.communityTopic;
  const isGroup = channelType === ChannelType.group;
  const isCs = channelType === ChannelType.customerService;
  const isAi = isPrivate && !!isBot;
  const hasMention = mentionCount > 0;
  const hasUnread = unread > 0;

  const avatarTag = useChannelAvatarTag(channelId, channelType);
  const avatarUrl = resolveAvatarUrl({
    baseURL,
    channelId,
    channelType,
    spaceId: spaceId ?? null,
    logo,
    cacheTag: avatarTag,
  });
  const initials = getInitials(name);
  const fallbackBg = getTitleColor(name);

  // 统一圆角方头像 32×32
  const avatarShape = "rounded-md";

  return (
    <div
      className={cn(
        "relative grid h-8 w-8 shrink-0 place-items-center transition-all duration-150",
        muted && "opacity-55",
      )}
    >
      {hasMention ? (
        /* mention：整个槽位替换成大橙色 @ 方块（对齐 mirror wk-sidepanel-rail-icon-mention） */
        <span
          role="img"
          aria-label={`@ 我 ${mentionCount > 1 ? mentionCount : ""}`}
          className={cn(
            "grid h-8 w-8 place-items-center font-extrabold leading-none text-white select-none",
            avatarShape,
            "bg-[#F97316] shadow-[0_2px_6px_rgba(249,115,22,0.4)]",
            "text-[18px] tracking-tight",
            active && "ring-2 ring-[#6366f1] ring-offset-2 ring-offset-(--color-background)",
            "animate-pulse",
          )}
        >
          @
        </span>
      ) : (
        <>
          <Avatar
            className={cn(
              "h-8 w-8 overflow-hidden",
              avatarShape,
              "ring-1 ring-black/[0.08] dark:ring-white/10",
              active && "ring-2 ring-[#6366f1]",
            )}
          >
            {avatarUrl && (
              <AvatarImage src={avatarUrl} alt={name} className={cn("object-cover", avatarShape)} />
            )}
            <AvatarFallback
              className={cn(
                "text-white font-semibold leading-none tracking-tight select-none",
                avatarShape,
                initials.length >= 2 ? "text-[11px]" : "text-[15px]",
              )}
              style={{ background: fallbackBg }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* 右下角 18px 类型角标 */}
          {isThread && (
            <span
              aria-hidden
              className="absolute -right-[3px] -bottom-[3px] grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] border-(--color-background) text-[11px] font-black leading-none text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
              style={{ background: getThreadHueColor(name) }}
            >
              #
            </span>
          )}
          {isGroup && (
            <span
              aria-hidden
              title="群聊"
              className="absolute -right-[3px] -bottom-[3px] grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] border-(--color-background) bg-[#3B82F6] text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
            >
              <Users className="h-[11px] w-[11px]" strokeWidth={2.75} />
            </span>
          )}
          {isCs && (
            <span
              aria-hidden
              title="客服"
              className="absolute -right-[3px] -bottom-[3px] grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] border-(--color-background) bg-[#F59E0B] text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
            >
              <Headphones className="h-[11px] w-[11px]" strokeWidth={2.75} />
            </span>
          )}
          {isAi && (
            <span
              aria-hidden
              title="AI"
              className="absolute -right-[3px] -bottom-[3px] grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] border-(--color-background) text-[9px] font-extrabold leading-none tracking-tight text-white shadow-[0_1px_3px_rgba(123,137,244,0.45)]"
              style={{ background: "linear-gradient(135deg, #7B89F4 0%, #9D78F5 100%)" }}
            >
              AI
            </span>
          )}
        </>
      )}

      {/* 未读 badge：mirror 风格的数字胶囊 */}
      {hasUnread && (
        <span
          role="status"
          aria-label={`未读 ${unread}`}
          className={cn(
            "absolute -top-[4px] -right-[6px] grid h-[17px] min-w-[17px] place-items-center rounded-full px-[5px] text-[10.5px] font-bold leading-none text-white",
            muted
              ? "bg-(--color-muted-foreground) shadow-[0_0_0_1.5px_var(--color-background),0_1px_3px_rgba(0,0,0,0.15)]"
              : "bg-[#F54A45] shadow-[0_0_0_1.5px_var(--color-background),0_0_0_2.5px_#F54A45,0_1px_3px_rgba(0,0,0,0.15)]",
          )}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </div>
  );
}

function resolveAvatarUrl(opts: {
  baseURL: string;
  channelId: string;
  channelType: number;
  spaceId: string | null;
  logo?: string;
  cacheTag?: string;
}): string {
  const { baseURL, channelId, channelType, spaceId, logo, cacheTag } = opts;
  if (!baseURL || !channelId) return "";
  if (channelType === ChannelType.person || channelType === ChannelType.customerService) {
    const cleanLogo = logo?.trim();
    return resolvePersonAvatar({
      baseURL,
      channelId,
      spaceId,
      ...(cleanLogo && { logo: cleanLogo }),
      ...(cacheTag && { cacheTag }),
    });
  }
  // 子区：忽略调用方传入的 logo —— 子区 channelInfo.logo 通常是创建子区时的父群头像
  // 快照副本，父群头像更新后不会同步。强制走 channelAvatarUrl，由它内部按父群
  // cacheTag 拼 URL，bumpAvatarTag(parent, group) 触发后立刻刷新。
  if (channelType === ChannelType.communityTopic) {
    return channelAvatarUrl(baseURL, channelId, channelType, spaceId, cacheTag);
  }
  // group / 其他：channelInfo.logo 优先，但必须带 ?v=tag cache buster，
  // 否则 sidepanel 重开后浏览器仍命中旧 disk cache。
  const cleanLogo = logo?.trim();
  if (cleanLogo)
    return resolveLogoUrl({
      baseURL,
      channelId,
      channelType,
      logo: cleanLogo,
      ...(cacheTag && { cacheTag }),
    });
  return channelAvatarUrl(baseURL, channelId, channelType, spaceId, cacheTag);
}
