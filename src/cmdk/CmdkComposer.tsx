import { forwardRef, type Ref, useEffect, useImperativeHandle, useRef } from "react";
import { toast } from "sonner";
import { useChannelMembers } from "@/api/queries/members";
import { buildCmdkMessageText, type PanelContext } from "@/cmdk/buildCmdkMessageText";
import { buildSelectionMarkdownFile } from "@/cmdk/buildSelectionMarkdownFile";
import type { PickedTarget } from "@/cmdk/CmdkChannelPicker";
import { CmdkQuoteBlock } from "@/cmdk/CmdkQuoteBlock";
import { getSendErrorMessage, withSendAck } from "@/cmdk/sendAck";
import { resolveApp } from "@/cmdk/urlApps";
import {
  MessageInputCore,
  type MessageInputCoreHandle,
  type MessageInputCoreSubmitPayload,
} from "@/components/composer/MessageInputCore";
import { ChannelType } from "@/const/channel";
import { MessageContentType } from "@/const/message";
import { sendFile, sendFileAndWaitAck, sendImage, sendText } from "@/im/send";
import { sendMessage } from "@/platform/messaging";
import { cmdkLastTargetStorage } from "@/platform/storage";
import { selectName, selectUID, useAuthStore } from "@/stores/auth";

interface CmdkComposerProps {
  picked: PickedTarget | null;
  ctx: PanelContext;
  longSel: boolean;
  /** 发送成功后关闭 cmdk panel；带 message 时由 CmdkApp 触发 toast */
  onSent: (message?: string) => void;
  /** sending 状态变化（cmdk panel 用来显示遮罩） */
  onSendingChange?: (sending: boolean) => void;
}

export interface CmdkComposerHandle {
  addFiles: (files: File[]) => void;
}

const PLACEHOLDER_HAS_TARGET = "";
const PLACEHOLDER_NO_TARGET = "";

export const CmdkComposer = forwardRef<CmdkComposerHandle, CmdkComposerProps>(function CmdkComposer(
  { picked, ctx, longSel, onSent, onSendingChange }: CmdkComposerProps,
  ref: Ref<CmdkComposerHandle>,
) {
  const isGroup = picked != null && picked.channelType !== ChannelType.person;
  const { data: members } = useChannelMembers({
    channelId: isGroup ? picked.channelId : null,
  });
  const myUid = useAuthStore(selectUID);
  const myName = useAuthStore(selectName);
  const coreRef = useRef<MessageInputCoreHandle | null>(null);
  const disabled = !picked;
  const app = resolveApp(ctx.pageUrl, ctx.hostname);
  const hasQuote = Boolean(ctx.pageUrl || ctx.selectedText);
  const headerSlot = hasQuote ? (
    <div className="mb-2">
      <CmdkQuoteBlock ctx={ctx} app={app} compact />
    </div>
  ) : null;

  useImperativeHandle(
    ref,
    () => ({
      addFiles: (files: File[]) => coreRef.current?.addFiles(files),
    }),
    [],
  );

  // 选完 target 后自动 focus，让用户直接打字
  useEffect(() => {
    if (picked) coreRef.current?.focus();
  }, [picked]);

  async function onSubmit({ text, attachments }: MessageInputCoreSubmitPayload): Promise<void> {
    if (!picked) return; // 安全兜底，UI 已禁
    // ① 必须在所有 await 之前同步发出，保住 user activation，
    //   否则 background 拿不到手势，chrome.sidePanel.open() 会失败。
    void sendMessage("requestOpenConversation", {
      channelId: picked.channelId,
      channelType: picked.channelType,
    }).catch(() => {});

    const trimmed = text.trim();
    const hasText = trimmed !== "";

    try {
      // ② 普通附件：图片走 sendImage，其他走 sendFile，并发即可
      const attachTasks: Promise<unknown>[] = attachments.map((f) => {
        const send = f.type.startsWith("image/")
          ? sendImage(picked.channelId, picked.channelType, f)
          : sendFile(picked.channelId, picked.channelType, f);
        return withSendAck(send);
      });

      if (longSel) {
        // ③ 长选区：先发 .md 文件并等 sendack（拿真实 messageId/messageSeq），
        //   再用 ReplyInfo 把用户输入作为引用消息指过去；与 mirror CmdKApp 同款。
        const mdFile = buildSelectionMarkdownFile(ctx);
        // 普通附件不阻塞 md 文件 ack；md 文件 ack 不到拿不到 reply 目标
        await Promise.all(attachTasks);
        const fileAck = await withSendAck(
          sendFileAndWaitAck(picked.channelId, picked.channelType, mdFile),
        );

        if (hasText) {
          // 引用消息正文：跳过原文 body（已写入 md 首行的「来自 …」），仅留用户输入
          const built = buildCmdkMessageText(trimmed, ctx, { skipQuotedBody: true });
          if (built.content) {
            const replyInfo = {
              messageId: fileAck.messageId,
              messageSeq: fileAck.messageSeq,
              fromUid: myUid ?? "",
              fromName: myName ?? "",
              digest: "[文件]",
              content: { type: MessageContentType.file, data: fileAck.fileContent },
            };
            await withSendAck(
              sendText(picked.channelId, picked.channelType, built.content, { replyInfo }),
            );
          }
        }
      } else {
        // ④ 短选区：附件 + 文本并发，保留原行为
        const built = buildCmdkMessageText(trimmed, ctx);
        const tasks = [...attachTasks];
        if (built.content) {
          tasks.push(withSendAck(sendText(picked.channelId, picked.channelType, built.content)));
        }
        await Promise.all(tasks);
      }
    } catch (err) {
      toast.error(getSendErrorMessage(err));
      throw err;
    }

    // ⑤ 落地 + 关 panel（toast 由 CmdkApp.close 显示，避免 iframe 卸载导致瞬闪）
    void cmdkLastTargetStorage.setValue(picked);
    onSent(`已发送到 ${picked.name}`);
  }

  return (
    <MessageInputCore
      ref={coreRef}
      members={isGroup ? members : []}
      {...(picked && { channelType: picked.channelType })}
      draftKey={null}
      placeholder={picked ? PLACEHOLDER_HAS_TARGET : PLACEHOLDER_NO_TARGET}
      disabled={disabled}
      enableVoice={!disabled}
      shellClassName="octo-composer-shell-cmdk"
      headerSlot={headerSlot}
      onSubmit={onSubmit}
      {...(onSendingChange && { onSendingChange })}
    />
  );
});
