import { ChevronDown, X } from "lucide-react";
import { AiBadge } from "@/components/octo/AiBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChannelType } from "@/const/channel";
import { useBotUidSet } from "@/hooks/useBotUidSet";
import { avatarGradient, getFirstChar } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import type { PickedTarget } from "./CmdkChannelPicker";

interface CmdkTopBarProps {
  target: PickedTarget | null;
  onPickTarget: () => void;
  onClose: () => void;
  dragHandlers: { onPointerDown: (e: React.PointerEvent<HTMLElement>) => void };
  dragging: boolean;
}

const BRAND_GRADIENT = "linear-gradient(135deg, #7C5CFC 0%, #00D4AA 100%)";

function typeLabel(type: number): string {
  if (type === ChannelType.person) return "联系人";
  if (type === ChannelType.group) return "频道";
  if (type === ChannelType.communityTopic) return "子区";
  return "其他";
}

export function CmdkTopBar({
  target,
  onPickTarget,
  onClose,
  dragHandlers,
  dragging,
}: CmdkTopBarProps) {
  const botSet = useBotUidSet();
  const isBot =
    target != null &&
    target.channelType === ChannelType.person &&
    (target.isBot === true || botSet.has(target.channelId));
  return (
    <div
      onPointerDown={dragHandlers.onPointerDown}
      title="按住可拖动浮层"
      className={cn(
        "flex select-none items-center gap-2 px-3.5 py-2.5",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      {/* 左侧身份：紫青渐变 avatar + "发送到 Octo" */}
      <span className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm"
          style={{ background: BRAND_GRADIENT }}
        >
          <span className="text-[13px] leading-none">✦</span>
        </span>
        <span className="text-[13px] font-medium text-(--color-foreground)">
          发送到{" "}
          <span
            className="bg-clip-text font-semibold text-transparent"
            style={{ backgroundImage: BRAND_GRADIENT }}
          >
            Octo
          </span>
        </span>
      </span>

      <span className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          data-no-drag
          onClick={onPickTarget}
          className="flex h-7 items-center gap-1.5 rounded-md border border-(--color-border)/60 bg-(--color-muted)/40 px-2 text-[12px] text-(--color-foreground) transition-colors hover:bg-(--color-muted)/70"
        >
          {target ? (
            <>
              <Avatar className="h-[18px] w-[18px]">
                {target.avatar && (
                  <AvatarImage src={target.avatar} alt={target.name} />
                )}
                <AvatarFallback
                  className="rounded-md text-[9px] font-semibold text-white"
                  style={{ background: avatarGradient(target.name) }}
                >
                  {getFirstChar(target.name)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[160px] truncate">{target.name}</span>
              {isBot && <AiBadge size="sm" />}
              <span className="rounded-full bg-(--color-background)/70 px-1.5 py-0.5 text-[10px] font-medium text-(--color-muted-foreground)">
                {typeLabel(target.channelType)}
              </span>
            </>
          ) : (
            <span className="text-(--color-muted-foreground)">选择目标</span>
          )}
          <ChevronDown className="h-3 w-3 text-(--color-muted-foreground)" />
        </button>
        <button
          type="button"
          data-no-drag
          onClick={onClose}
          aria-label="关闭"
          className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-(--color-muted-foreground) transition-colors hover:bg-(--color-muted)/70 hover:text-(--color-foreground)"
        >
          <X className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </span>
    </div>
  );
}
