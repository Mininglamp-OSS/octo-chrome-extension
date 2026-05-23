import { CornerDownRight, X } from "lucide-react";
import { toast } from "sonner";
import {
  MessageInputCore,
  type MessageInputCoreSubmitPayload,
} from "@/components/composer/MessageInputCore";
import { buildChatContext } from "@/components/composer/voice/buildChatContext";
import { sendFile, sendImage, sendSticker, sendText } from "@/im/send";
import { useAuthStore } from "@/stores/auth";
import { channelKey, useReplyDraft } from "@/stores/replyDraft";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

interface ComposerProps {
  channelId: string;
  channelType: number;
  members?: import("@/api/schemas/member").Member[];
  /** 最近消息（给语音 chat_context 拼接，取最后 10 条） */
  messages?: import("@/im/message").MessageView[];
  /** 私聊时对方的 Member（给 memberContext 用） */
  peer?: import("@/api/schemas/member").Member;
}

export function Composer({ channelId, channelType, members, messages, peer }: ComposerProps) {
  const loginUid = useAuthStore((s) => s.state?.uid ?? "");
  const ck = channelKey(channelId, channelType);
  const reply = useReplyDraft((s) => s.byChannel.get(ck));
  const clearReply = useReplyDraft((s) => s.clear);

  const headerSlot = reply ? (
    <div className="octo-composer-reply">
      <CornerDownRight className="octo-composer-reply-icon" />
      <div className="octo-composer-reply-body">
        <div className="octo-composer-reply-name">引用 {reply.fromName}</div>
        <div className="octo-composer-reply-text">{reply.digest}</div>
      </div>
      <button
        type="button"
        className="octo-composer-reply-close"
        onClick={() => clearReply(ck)}
        title="取消引用"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  ) : null;

  async function onSubmit({
    text,
    mentionInfo,
    attachments,
  }: MessageInputCoreSubmitPayload): Promise<void> {
    try {
      for (const file of attachments) {
        if (file.type.startsWith("image/")) {
          await sendImage(channelId, channelType, file);
        } else {
          await sendFile(channelId, channelType, file);
        }
      }
      if (text) {
        const replyInfo = reply
          ? {
              messageId: reply.messageId,
              messageSeq: reply.messageSeq,
              fromUid: reply.fromUid,
              fromName: reply.fromName,
              digest: reply.digest,
              content: reply.content,
            }
          : undefined;
        await sendText(channelId, channelType, text, {
          ...(replyInfo && { replyInfo }),
          ...(mentionInfo?.uids.length && { mentionUids: mentionInfo.uids }),
          ...(mentionInfo?.all && { mentionAll: true }),
          ...(mentionInfo?.entities.length && { mentionEntities: mentionInfo.entities }),
        });
      }
      clearReply(ck);
    } catch (err) {
      toast.error(extractErrorMsg(err) || "发送失败");
      throw err;
    }
  }

  return (
    <MessageInputCore
      members={members}
      channelType={channelType}
      voiceChatContext={() =>
        buildChatContext({
          messages: messages ?? [],
          members: members ?? [],
          channelType,
          loginUid,
          ...(peer && { peer }),
        })
      }
      draftKey={{ channelId, channelType }}
      shellClassName="octo-composer-shell-sidepanel"
      headerSlot={headerSlot}
      onSubmit={onSubmit}
      onStickerSend={(s) => {
        void sendSticker(channelId, channelType, s).catch((err) => {
          toast.error(extractErrorMsg(err) || "发送失败");
        });
      }}
    />
  );
}
