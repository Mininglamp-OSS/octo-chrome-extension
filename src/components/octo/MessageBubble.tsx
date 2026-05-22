import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRevokeMessage } from "@/api/queries/messages";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ChannelType } from "@/const/channel";
import type { MessageView } from "@/im/message";
import { buildThreadChannelId, isThreadChannelId } from "@/im/thread";
import type { MessageRenderCtx } from "@/messages/core/defineMessageType";
import { getModuleOrUnknown } from "@/messages/core/registry";
import { useAuthStore } from "@/stores/auth";
import { channelKey, useReplyDraft } from "@/stores/replyDraft";
import { useThreadStore } from "@/stores/thread";
import { cn } from "@/utils/cn";
import { extractErrorMsg } from "@/utils/extractErrorMsg";
import { formatMessageTime } from "@/utils/time";
import { MessageAvatar } from "./MessageAvatar";
import { MessageContentView } from "./MessageContent";

/** reply 引用预览的摘要 —— 由 registry 模块的 digest 提供 */
function digestForReply(content: MessageView["content"]): string {
  const mod = getModuleOrUnknown(content.type);
  try {
    const d = mod.digest(content.data);
    return d.length > 40 ? `${d.slice(0, 40)}…` : d || "[消息]";
  } catch {
    return "[消息]";
  }
}

interface MessageBubbleProps {
  message: MessageView;
  /** 与上一条同人且 60s 内 → 合并：不显示头像/名字/时间 */
  groupedWithPrev: boolean;
  /** 群成员名查表，从 channel members 拿到的 uid → name */
  displayName?: string;
  /** 群成员头像 */
  avatarUrl?: string;
}

export function MessageBubble({
  message,
  groupedWithPrev,
  displayName,
  avatarUrl,
}: MessageBubbleProps) {
  const myUid = useAuthStore((s) => s.state?.uid);
  const myName = useAuthStore((s) => s.state?.name);
  const isSelf = myUid != null && message.fromUid === myUid;

  const revoke = useRevokeMessage();
  const setDraft = useReplyDraft((s) => s.set);
  const openThread = useThreadStore((s) => s.open);

  const canThread =
    message.channelType !== ChannelType.person && !isThreadChannelId(message.channelId);

  if (message.revoked) {
    const who = isSelf ? "你" : (displayName ?? message.revoker ?? "对方");
    return (
      <div className="flex justify-center px-3 py-1.5">
        <span className="rounded-full bg-(--color-muted)/50 px-3 py-1 text-[11px] text-(--color-muted-foreground)">
          {who}撤回了一条消息
        </span>
      </div>
    );
  }

  const mod = getModuleOrUnknown(message.content.type);
  const renderCtx: MessageRenderCtx = {
    isSelf,
    channelId: message.channelId,
    channelType: message.channelType,
    fromUid: message.fromUid,
    messageId: message.messageId,
  };

  // 系统消息：居中胶囊布局，不渲染头像/名字/时间
  if (mod.category === "system") {
    return (
      <div className="octo-msg-system flex justify-center px-3 py-1">
        <MessageContentView content={message.content} ctx={renderCtx} />
      </div>
    );
  }

  async function onCopy(): Promise<void> {
    if (mod.copyable !== "text") return;
    try {
      const text = mod.digest(message.content.data);
      if (!text) return;
      await navigator.clipboard.writeText(text);
      toast.success("已复制");
    } catch {
      toast.error("复制失败");
    }
  }

  function onReply(): void {
    setDraft(channelKey(message.channelId, message.channelType), {
      messageId: message.messageId,
      from: message.fromUid,
      text: digestForReply(message.content),
    });
  }

  function onOpenThread(): void {
    openThread({
      channelId: buildThreadChannelId(message.channelId, message.messageId),
      channelType: ChannelType.communityTopic,
      parentChannelId: message.channelId,
      parentChannelType: message.channelType,
      parentDigest: digestForReply(message.content),
    });
  }

  async function onRevoke(): Promise<void> {
    try {
      await revoke.mutateAsync({
        channelId: message.channelId,
        channelType: message.channelType,
        messageId: message.messageId,
        ...(message.clientMsgNo && { clientMsgNo: message.clientMsgNo }),
      });
      toast.success("已撤回");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "撤回失败");
    }
  }

  const showHeader = !groupedWithPrev;
  const name = isSelf ? (myName ?? "你") : (displayName ?? message.fromUid);
  const canCopy = mod.copyable === "text";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "octo-msg-row group relative flex w-full gap-2 px-3",
            isSelf ? "octo-msg-row--send flex-row-reverse" : "octo-msg-row--recv flex-row",
            groupedWithPrev ? "octo-msg-row--continue mt-0.5" : "octo-msg-row--first mt-3",
          )}
        >
          <div
            aria-hidden="true"
            className={cn("octo-msg-rail shrink-0", isSelf ? "hidden" : "block w-8")}
          >
            {!isSelf && showHeader && <MessageAvatar name={name} src={avatarUrl} />}
          </div>
          <div
            className={cn(
              "octo-msg-content flex min-w-0 max-w-[78%] flex-col gap-0.5",
              isSelf ? "items-end" : "items-start",
            )}
          >
            {showHeader && (
              <div
                className={cn(
                  "octo-msg-header flex items-center gap-2 px-1",
                  isSelf && "flex-row-reverse",
                )}
              >
                <span className="octo-msg-name text-xs font-medium text-(--color-foreground)">
                  {name}
                </span>
                <span className="octo-msg-time text-[10px] text-(--color-muted-foreground)">
                  {formatMessageTime(message.timestamp * 1000)}
                </span>
              </div>
            )}
            <div
              className={cn("octo-msg-body flex items-center gap-1", isSelf && "flex-row-reverse")}
            >
              <div className={cn("octo-msg-bubble", message.sendFailed && "opacity-70")}>
                <MessageContentView content={message.content} ctx={renderCtx} />
              </div>
              {message.sendFailed && (
                <span
                  className="inline-flex shrink-0"
                  title={
                    message.reasonCode === -1
                      ? "发送失败：IM 未连接或超时"
                      : `发送失败 (reasonCode=${message.reasonCode ?? "?"})`
                  }
                >
                  <AlertCircle
                    className="h-3.5 w-3.5 text-(--color-destructive)"
                    aria-label="发送失败"
                  />
                </span>
              )}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        {canCopy && <ContextMenuItem onSelect={() => void onCopy()}>复制</ContextMenuItem>}
        <ContextMenuItem onSelect={onReply}>引用</ContextMenuItem>
        {canThread && <ContextMenuItem onSelect={onOpenThread}>打开子区</ContextMenuItem>}
        {isSelf && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-(--color-destructive)"
              onSelect={() => void onRevoke()}
            >
              撤回
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
