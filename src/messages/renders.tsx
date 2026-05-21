import { toast } from "sonner";
import { BubbleShell } from "@/messages/core/BubbleShell";
import type { MessageRender } from "@/messages/core/defineMessageType";
import { registerRender } from "@/messages/core/registry";
import { FileBubble } from "@/messages/file/FileBubble";
import { FILE_TYPE, type FileContent } from "@/messages/file/FileMessage";
import type { SystemMessageUI } from "@/messages/helpers/defineSystemMessage";
import { SystemPill } from "@/messages/helpers/SystemPill";
import { ImageBubble } from "@/messages/image/ImageBubble";
import { IMAGE_TYPE, type ImageContent } from "@/messages/image/ImageMessage";
import { LottieBubble } from "@/messages/lottieSticker/LottieBubble";
import {
  LOTTIE_STICKER_TYPE,
  type LottieStickerContent,
} from "@/messages/lottieSticker/LottieStickerMessage";
import { addMembers } from "@/messages/system/addMembers";
import { channelUpdate } from "@/messages/system/channelUpdate";
import { createGroup } from "@/messages/system/createGroup";
import { newGroupOwner } from "@/messages/system/newGroupOwner";
import { removeMembers } from "@/messages/system/removeMembers";
import { threadCreated } from "@/messages/system/threadCreated";
import { TextBubble } from "@/messages/text/TextBubble";
import { TEXT_TYPE } from "@/messages/text/TextMessage";
import type { UnknownUI } from "@/messages/unknown";
import { VoiceBubble } from "@/messages/voice/VoiceBubble";
import { VOICE_TYPE, type VoiceContent } from "@/messages/voice/VoiceMessage";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

/**
 * UI 端集中注册所有 message Render 组件 —— 必须在 sidepanel / cmdk / options 等
 * UI context 启动时调用一次。background service worker 永远不调，避免把 react-markdown
 * 等 UI 依赖链拽进 SW bundle。
 */
let registered = false;
export function registerAllRenders(): void {
  if (registered) return;
  registered = true;

  // chat
  registerRender(TEXT_TYPE, TextBubble);
  registerRender(IMAGE_TYPE, (({ data }) => (
    <ImageBubble data={data} />
  )) satisfies MessageRender<ImageContent>);
  registerRender(VOICE_TYPE, (({ data, ctx }) => (
    <VoiceBubble data={data} isSelf={ctx.isSelf} />
  )) satisfies MessageRender<VoiceContent>);
  registerRender(FILE_TYPE, (({ data }) => (
    <FileBubble data={data} />
  )) satisfies MessageRender<FileContent>);
  registerRender(LOTTIE_STICKER_TYPE, (({ data }) => (
    <LottieBubble data={data} />
  )) satisfies MessageRender<LottieStickerContent>);

  // system —— 1000-2000 段默认都走 SystemPill；个别 type 自定义
  const systemTypes = [
    createGroup.type,
    addMembers.type,
    removeMembers.type,
    channelUpdate.type,
    newGroupOwner.type,
    threadCreated.type,
  ];
  for (const t of systemTypes) {
    registerRender(t, (({ data }) => (
      <SystemPill displayText={data.displayText} />
    )) satisfies MessageRender<SystemMessageUI>);
  }

  // 1009 approveGroupMember —— SystemPill + 「去审核」按钮
  registerRender(1009, (({ data, ctx }) => {
    const inviteNo = String(data.payload.invite_no ?? "");
    const canApprove = ctx.channelId.length > 0 && inviteNo.length > 0;
    return (
      <SystemPill displayText={data.displayText}>
        {canApprove && (
          <button
            type="button"
            onClick={() => void goApproval(ctx.channelId, inviteNo)}
            className="ml-1 text-(--color-primary) underline-offset-2 hover:underline"
          >
            去审核
          </button>
        )}
      </SystemPill>
    );
  }) satisfies MessageRender<SystemMessageUI>);

  // unknown / 兜底：SystemContent → 直接渲染 displayText；其它 → 「暂不支持」气泡
  registerRender(-1, (({ data, ctx }) => {
    if (data.displayText) return <SystemPill displayText={data.displayText} />;
    const label = data.realType > 0 ? data.realType : data.type;
    return (
      <BubbleShell isSelf={ctx.isSelf}>
        <span className="text-xs text-(--color-muted-foreground)">
          [此消息暂不支持，请至手机端查看 ({label})]
        </span>
      </BubbleShell>
    );
  }) satisfies MessageRender<UnknownUI>);
}

async function goApproval(groupNo: string, inviteNo: string): Promise<void> {
  try {
    const { api } = await import("@/api/client");
    const body = await api
      .get(`groups/${groupNo}/member/h5confirm`, { searchParams: { invite_no: inviteNo } })
      .json<{ url?: string }>();
    const url = body?.url;
    if (!url || !isSafeHttpUrl(url)) {
      toast.error("审核链接无效");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (err) {
    toast.error(extractErrorMsg(err) || "获取审核链接失败");
  }
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
