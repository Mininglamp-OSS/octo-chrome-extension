import { Headphones, Users } from "lucide-react";
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
  /** 私聊场景下，channelId 是否为 AI bot —— 由调用方反查 botSet/channelInfo 后传入 */
  isBot?: boolean;
}

/**
 * Rail 上的 pin item 头像。
 *
 * 视觉规则：
 *  - 所有 channel 统一圆角方 32×32（`rounded-md`），形状一致便于扫视
 *  - 子区：父群头像（由 channelAvatarUrl 自动回落到 parent group）+ 右下 18px 圆形 # 角标，
 *    颜色 hash 子区名 → 同群多个子区可视觉区分
 *  - 群 / 客服 / AI：右下 18px 圆形角标
 *  - 真头像优先 → fallback 走 getInitials（双字符 / 词首缩写 / emoji）
 *  - 描边：未激活也有一道极淡 ring（黑 8% / 暗色白 10%），让方头像在浅底色 rail 上有轮廓；
 *    激活时覆盖为 ring-2 主色 + offset
 *  - 未读：右上 7px 红点
 *  - @me：右上 14px 橙色徽标（覆盖红点，但**不替换主体**，保留头像辨识）
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
  isBot,
}: RailAvatarProps) {
  const isPrivate = channelType === ChannelType.person;
  const isThread = channelType === ChannelType.communityTopic;
  const isGroup = channelType === ChannelType.group;
  const isCs = channelType === ChannelType.customerService;
  const isAi = isPrivate && !!isBot;
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

  // 统一圆角方头像 32×32
  const avatarShape = "rounded-md";

  return (
    <div
      className={cn(
        "relative grid h-8 w-8 shrink-0 place-items-center transition-all duration-150",
        muted && "opacity-55",
      )}
    >
      <Avatar
        className={cn(
          "h-8 w-8 overflow-hidden",
          avatarShape,
          // 未激活：极淡描边，浅/暗主题各一套
          "ring-1 ring-black/[0.08] dark:ring-white/10",
          // 激活：indigo 贴边 2px（与 mention chip / composer 一致的 active 色，
          // 避免用 --color-primary —— zinc 主题下它是接近黑色，框感太重）
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

      {/* 右下角 18px 类型角标（channelType 互斥）：
          子区 # / 群 Users / 客服 Headphones / AI 文字。
          私聊普通用户不挂角标（圆形头像本身已足够辨识）。 */}
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
          className="absolute -right-[3px] -bottom-[3px] grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] border-(--color-background) text-[9px] font-extrabold leading-none tracking-tight text-white shadow-[0_1px_2px_rgba(123,137,244,0.45)]"
          style={{ background: "linear-gradient(135deg, #7B89F4 0%, #9D78F5 100%)" }}
        >
          AI
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
