import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, Layers, X } from "lucide-react";
import { useMemo } from "react";
import { getApiUrl } from "@/api/client";
import { MessageAvatar } from "@/components/octo/MessageAvatar";
import { MessageContentView } from "@/components/octo/MessageContent";
import { Sheet, SheetPortal } from "@/components/ui/sheet";
import { ChannelType } from "@/const/channel";
import type { MessageRenderCtx } from "@/messages/core/defineMessageType";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";
import { useUIStore } from "@/stores/ui";
import { channelAvatarUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { formatMessageTime } from "@/utils/time";
import type { MergeForwardContent, MergeForwardSubUI, MergeForwardUser } from "./index";
import { subToSerialized } from "./lazyDecode";
import { mergeForwardTitle } from "./titleOf";

/** 同发送者连续合并阈值（秒）—— 与主聊天 MessageList 60s 合并对齐 */
const GROUP_WINDOW_SEC = 60;

export function MergeForwardPanel() {
  const stack = useUIStore((s) => s.mergeForwardStack);
  const popMergeForward = useUIStore((s) => s.popMergeForward);
  const closeMergeForward = useUIStore((s) => s.closeMergeForward);

  const open = stack.length > 0;
  const current = stack.at(-1);
  const canBack = stack.length > 1;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeMergeForward()}>
      <SheetPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-full flex-col",
            "bg-(--color-background) shadow-xl",
            "duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
            "focus:outline-none",
          )}
        >
          {/* 占位 hidden title 满足 radix 的 a11y 要求 */}
          <DialogPrimitive.Title className="sr-only">
            {current?.title || "聊天记录"}
          </DialogPrimitive.Title>

          {current && (
            <>
              <PanelHeader
                title={mergeForwardTitle(current)}
                canBack={canBack}
                onBack={popMergeForward}
                onClose={closeMergeForward}
              />
              <PanelCrumb stack={stack} />
              <PanelBody content={current} />
            </>
          )}
        </DialogPrimitive.Content>
      </SheetPortal>
    </Sheet>
  );
}

function PanelHeader({
  title,
  canBack,
  onBack,
  onClose,
}: {
  title: string;
  canBack: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative flex h-12 shrink-0 items-center border-b border-(--color-border)/60 px-3">
      <div className="flex w-8 items-center">
        {canBack && (
          <button
            type="button"
            onClick={onBack}
            title="返回上一层"
            className="flex h-7 w-7 items-center justify-center rounded-md text-(--color-foreground) hover:bg-(--color-muted)"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 truncate text-center text-sm font-semibold text-(--color-foreground)">
        {title}
      </div>
      <div className="flex w-8 items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          title="关闭"
          className="flex h-7 w-7 items-center justify-center rounded-md text-(--color-muted-foreground) hover:bg-(--color-muted) hover:text-(--color-foreground)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PanelCrumb({ stack }: { stack: MergeForwardContent[] }) {
  const current = stack.at(-1);
  if (!current) return null;
  const msgCount = current.msgs.length;
  const userCount = current.users.length;
  return (
    <div className="flex items-center gap-2 border-b border-(--color-border)/60 bg-(--color-primary)/4 px-4 py-2 text-[11.5px] text-(--color-muted-foreground)">
      <span className="inline-flex items-center gap-1 rounded-full bg-(--color-primary)/10 px-2 py-0.5 text-[10.5px] font-medium text-(--color-primary)">
        <Layers className="h-2.5 w-2.5" />
        聊天记录
      </span>
      <span>
        {msgCount} 条消息 · {userCount} 位成员
      </span>
      {stack.length > 1 && (
        <span className="ml-auto truncate text-[10.5px] text-(--color-muted-foreground)">
          {stack.map((s) => mergeForwardTitle(s)).join(" › ")}
        </span>
      )}
    </div>
  );
}

function PanelBody({ content }: { content: MergeForwardContent }) {
  const userMap = useMemo(() => {
    const m = new Map<string, MergeForwardUser>();
    for (const u of content.users) m.set(u.uid, u);
    return m;
  }, [content.users]);

  // 头像走统一 URL builder（对照 octo-web App.avatarChannel）：
  // {apiURL}users/{uid}/avatar?v=1。后端没设头像时返回占位图或 404，AvatarImage onError 自动落到首字 fallback。
  // 不需要 useChannelMembers / channelManager 查表 —— 那些路径在我们后端不一定有 avatar 字段。
  const baseURL = getApiUrl();
  const spaceId = useSpaceStore(selectCurrentSpaceId);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto py-3">
      {content.msgs.map((m, i) => {
        const prev = i > 0 ? content.msgs[i - 1] : undefined;
        const grouped =
          !!prev &&
          prev.fromUid === m.fromUid &&
          Math.abs(m.timestamp - prev.timestamp) <= GROUP_WINDOW_SEC;
        const avatar = channelAvatarUrl(baseURL, m.fromUid, ChannelType.person, spaceId);
        return (
          <SubMessageRow
            key={subKey(m, i)}
            sub={m}
            user={userMap.get(m.fromUid)}
            avatar={avatar}
            grouped={grouped}
          />
        );
      })}
      {content.msgs.length === 0 && (
        <div className="px-4 py-12 text-center text-xs text-(--color-muted-foreground)">
          没有消息
        </div>
      )}
    </div>
  );
}

function SubMessageRow({
  sub,
  user,
  avatar,
  grouped,
}: {
  sub: MergeForwardSubUI;
  user: MergeForwardUser | undefined;
  avatar: string | undefined;
  grouped: boolean;
}) {
  const serialized = useMemo(() => subToSerialized(sub), [sub]);
  const ctx: MessageRenderCtx = {
    isSelf: false,
    channelId: "",
    channelType: 0,
    fromUid: sub.fromUid,
    messageId: sub.messageId,
  };
  // payload users 自带的 name 是发送时快照（群里别名等更准），优先；否则用 uid 截断
  const name = user?.name || sub.fromUid.slice(0, 6) || "未知";

  return (
    <div className={cn("flex gap-2.5 px-4", grouped ? "-mt-1" : "")}>
      <div className="w-8 shrink-0">{!grouped && <MessageAvatar name={name} src={avatar} />}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-(--color-foreground)">{name}</span>
            <span className="text-[11px] text-(--color-muted-foreground) tabular-nums">
              {formatMessageTime(sub.timestamp * 1000)}
            </span>
          </div>
        )}
        <div className="text-[13.5px] leading-[1.55] text-(--color-foreground)">
          <MessageContentView content={serialized} ctx={ctx} />
        </div>
      </div>
    </div>
  );
}

/** messageId 可能重复（极端情况下后端转发链复用 id），降级用 fromUid+timestamp 拼 key */
function subKey(m: MergeForwardSubUI, i: number): string {
  if (m.messageId) return `m-${m.messageId}`;
  return `t-${m.fromUid}-${m.timestamp}-${i}`;
}
