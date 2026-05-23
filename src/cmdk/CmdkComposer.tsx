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
  type MessageInputCoreHandle,
  type MessageInputCoreSubmitPayload,
  MessageInputCore,
} from "@/components/composer/MessageInputCore";
import { ChannelType } from "@/const/channel";
import { sendFile, sendImage, sendText } from "@/im/send";
import { sendMessage } from "@/platform/messaging";
import { cmdkLastTargetStorage } from "@/platform/storage";

interface CmdkComposerProps {
  picked: PickedTarget | null;
  ctx: PanelContext;
  longSel: boolean;
  /** 发送成功后关闭 cmdk panel */
  onSent: () => void;
  /** sending 状态变化（cmdk panel 用来显示遮罩） */
  onSendingChange?: (sending: boolean) => void;
}

export interface CmdkComposerHandle {
  addFiles: (files: File[]) => void;
}

const PLACEHOLDER_HAS_TARGET = "输入消息  ·  回车发送  ·  Shift+回车换行";
const PLACEHOLDER_NO_TARGET = "先选择目标";
const SENT_CLOSE_DELAY = 200;

export const CmdkComposer = forwardRef<CmdkComposerHandle, CmdkComposerProps>(
  function CmdkComposer(
    { picked, ctx, longSel, onSent, onSendingChange }: CmdkComposerProps,
    ref: Ref<CmdkComposerHandle>,
  ) {
    const isGroup = picked != null && picked.channelType !== ChannelType.person;
    const { data: members } = useChannelMembers({
      channelId: isGroup ? picked.channelId : null,
    });
    const coreRef = useRef<MessageInputCoreHandle | null>(null);
    const disabled = !picked;
    const app = resolveApp(ctx.pageUrl, ctx.hostname);
    const hasQuote = Boolean(ctx.pageUrl || ctx.selectedText);
    const headerSlot = hasQuote ? (
      <div className="mb-2">
        <CmdkQuoteBlock ctx={ctx} app={app} />
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

    async function onSubmit({
      text,
      attachments,
    }: MessageInputCoreSubmitPayload): Promise<void> {
      if (!picked) return; // 安全兜底，UI 已禁
      // ① 必须在所有 await 之前同步发出，保住 user activation，
      //   否则 background 拿不到手势，chrome.sidePanel.open() 会失败。
      void sendMessage("requestOpenConversation", {
        channelId: picked.channelId,
        channelType: picked.channelType,
      }).catch(() => {});

      // ② 长选区（>500 字）转 .md 附件
      const filesToSend = [...attachments];
      if (longSel) filesToSend.push(buildSelectionMarkdownFile(ctx));

      // ③ 拼文本（quote 头 + 用户输入；长选区时跳过原文 body）
      const built = buildCmdkMessageText(text.trim(), ctx, { skipQuotedBody: longSel });

      // ④ 并发发送，12s 超时兜底
      const tasks: Promise<unknown>[] = filesToSend.map((f) => {
        const send = f.type.startsWith("image/")
          ? sendImage(picked.channelId, picked.channelType, f)
          : sendFile(picked.channelId, picked.channelType, f);
        return withSendAck(send);
      });
      if (built.content) {
        tasks.push(withSendAck(sendText(picked.channelId, picked.channelType, built.content)));
      }

      try {
        await Promise.all(tasks);
      } catch (err) {
        toast.error(getSendErrorMessage(err));
        throw err;
      }

      // ⑤ 落地 + 关 panel
      void cmdkLastTargetStorage.setValue(picked);
      toast.success(`已发送到 ${picked.name}`);
      window.setTimeout(onSent, SENT_CLOSE_DELAY);
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
  },
);
