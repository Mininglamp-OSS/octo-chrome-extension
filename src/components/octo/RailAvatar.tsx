import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChannelType } from "@/const/channel";
import {
  channelAvatarUrl,
  getInitials,
  resolveImageURL,
  resolvePersonAvatar,
} from "@/utils/avatar";
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
}

/**
 * Rail 上的 pin item 头像。
 *
 * 视觉规则（对照 .design/rail-pin-avatar.html 第 05 节）：
 *  - 私聊：圆形 26×26
 *  - 群聊：圆角方 32×32
 *  - 子区：父群头像（由 channelAvatarUrl 自动回落到 parent group）+ 右下 14px 圆形 # 角标，
 *    颜色 hash 子区名 → 同群多个子区可视觉区分
 *  - 真头像优先 → fallback 走 getInitials（双字符 / 词首缩写 / emoji）
 *  - 未读：右上 7px 红点
 *  - @me：右上 14px 橙色徽标（覆盖红点，但**不替换主体**，保留头像辨识）
 *  - 当前选中：ring-2 主色，描在容器外
 *  - 免打扰：整体 opacity 0.55，红点变灰
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
}: RailAvatarProps) {
  const isPrivate = channelType === ChannelType.person;
  const isThread = channelType === ChannelType.communityTopic;
  const hasMention = mentionCount > 0;
  const hasUnread = unread > 0 && !hasMention;

  const avatarUrl = resolveAvatarUrl({
    baseURL,
    channelId,
    channelType,
    spaceId: spaceId ?? null,
    logo,
  });
  const initials = getInitials(name);
  const fallbackBg = getTitleColor(name);

  // Avatar 主体尺寸：私聊 26×26，其他 32×32
  const avatarSize = isPrivate ? "h-[26px] w-[26px]" : "h-8 w-8";
  const avatarShape = isPrivate ? "rounded-full" : "rounded-md";

  // 容器始终 32×32 占位（私聊 26×26 居中），保证 rail 行高一致
  return (
    <div
      className={cn(
        "relative grid h-8 w-8 shrink-0 place-items-center transition-all duration-150",
        muted && "opacity-55",
      )}
    >
      <Avatar
        className={cn(
          "overflow-hidden",
          avatarSize,
          avatarShape,
          active && "ring-2 ring-(--color-primary) ring-offset-2 ring-offset-(--color-background)",
        )}
      >
        {avatarUrl && (
          <AvatarImage src={avatarUrl} alt={name} className={cn("object-cover", avatarShape)} />
        )}
        <AvatarFallback
          className={cn(
            "text-white font-semibold leading-none tracking-tight select-none",
            avatarShape,
            initials.length >= 2 ? "text-[11px]" : isPrivate ? "text-[13px]" : "text-[15px]",
          )}
          style={{ background: fallbackBg }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* 子区角标：右下 14px 圆形 # */}
      {isThread && (
        <span
          aria-hidden
          className="absolute -right-[3px] -bottom-[3px] grid h-[14px] w-[14px] place-items-center rounded-full border-[1.5px] border-(--color-background) text-[9px] font-extrabold leading-none text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
          style={{ background: getThreadHueColor(name) }}
        >
          #
        </span>
      )}

      {/* 未读：右上 7px 红点 */}
      {hasUnread && (
        <span
          aria-hidden
          className={cn(
            "absolute -right-[2px] -top-[2px] h-[8px] w-[8px] rounded-full border-[1.5px] border-(--color-background)",
            muted
              ? "bg-(--color-muted-foreground)"
              : "bg-[#F54A45] shadow-[0_0_0_0.5px_rgba(245,74,69,0.4)]",
          )}
        />
      )}

      {/* @me：右上 14px 橙色徽标，覆盖未读红点；mentionCount > 1 时显示数字 */}
      {hasMention && (
        <span
          aria-hidden
          className="absolute -right-[4px] -top-[4px] grid h-[14px] min-w-[14px] place-items-center rounded-full border-[1.5px] border-(--color-background) bg-[#F97316] px-[3px] text-[9px] font-extrabold leading-none text-white shadow-[0_1px_3px_rgba(249,115,22,0.45)]"
        >
          {mentionCount > 1 ? (mentionCount > 99 ? "99+" : mentionCount) : "@"}
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
