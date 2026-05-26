import { Channel } from "wukongimjssdk";
import { MessageContentType, MessageReasonCode } from "@/const/message";
import { isImConnected, onImMessageUpdated, sendImMessage as sdkSendImMessage } from "@/im/client";
import { imSendMessage } from "@/im/proxy";
import { ImNotConnectedError, REASON_TIMEOUT, reasonCodeToMessage } from "@/im/sendError";
import { rehydrateContent } from "@/im/serialize";
import { getImageDimensions, uploadAttachment } from "@/im/upload";
import type { FileContent } from "@/messages/file";
import type { ImageContent } from "@/messages/image";
import type { LottieStickerContent } from "@/messages/lottieSticker";
import type { ReplyInfo, TextContent } from "@/messages/text";
import type { VoiceContent } from "@/messages/voice";

export async function sendText(
  channelId: string,
  channelType: number,
  text: string,
  extra?: {
    mentionUids?: string[];
    mentionAll?: boolean;
    mentionEntities?: TextContent["mentionEntities"];
    replyInfo?: ReplyInfo;
  },
): Promise<string> {
  const data: TextContent = { text };
  if (extra?.mentionUids?.length) data.mentionUids = extra.mentionUids;
  if (extra?.mentionAll) data.mentionAll = true;
  if (extra?.mentionEntities?.length) data.mentionEntities = extra.mentionEntities;
  if (extra?.replyInfo) data.replyInfo = extra.replyInfo;
  return imSendMessage({
    channelId,
    channelType,
    content: { type: MessageContentType.text, data },
  });
}

export async function sendImage(
  channelId: string,
  channelType: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const [{ width, height }, { url }] = await Promise.all([
    getImageDimensions(file),
    uploadAttachment(file, channelId, channelType, onProgress),
  ]);
  const data: ImageContent = { url, width, height, name: file.name };
  return imSendMessage({
    channelId,
    channelType,
    content: { type: MessageContentType.image, data },
  });
}

export async function sendFile(
  channelId: string,
  channelType: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { url } = await uploadAttachment(file, channelId, channelType, onProgress);
  const dot = file.name.lastIndexOf(".");
  const data: FileContent = {
    name: file.name,
    extension: dot > 0 ? file.name.slice(dot + 1) : "",
    size: file.size,
    url,
  };
  return imSendMessage({
    channelId,
    channelType,
    content: { type: MessageContentType.file, data },
  });
}

/**
 * 发文件并等服务端 sendack 回填 messageId/messageSeq。
 *
 * 用于「先发附件再发引用消息」场景（如 cmdk 长选区）：
 * 普通 sendFile 拿到的是 stub messageID="0"，服务端确认前 reply 没法指过去；
 * 这里走 SDK 直发 + onImMessageUpdated 等 sendack，拿到真实 ack 后再返回。
 */
export interface SendFileAckResult {
  messageId: string;
  messageSeq: number;
  fileContent: FileContent;
}

export async function sendFileAndWaitAck(
  channelId: string,
  channelType: number,
  file: File,
  timeoutMs = 30_000,
): Promise<SendFileAckResult> {
  if (!isImConnected()) throw new ImNotConnectedError();

  const { url } = await uploadAttachment(file, channelId, channelType);
  const dot = file.name.lastIndexOf(".");
  const fileContent: FileContent = {
    name: file.name,
    extension: dot > 0 ? file.name.slice(dot + 1) : "",
    size: file.size,
    url,
  };

  const sdkContent = rehydrateContent({ type: MessageContentType.file, data: fileContent });
  const channel = new Channel(channelId, channelType);
  const stub = await sdkSendImMessage(sdkContent, channel);
  const targetClientMsgNo = stub.clientMsgNo;

  return await new Promise<SendFileAckResult>((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;
    const timer = setTimeout(() => {
      unsubscribe?.();
      reject(new Error(reasonCodeToMessage(REASON_TIMEOUT)));
    }, timeoutMs);

    unsubscribe = onImMessageUpdated((ev) => {
      if (ev.clientMsgNo !== targetClientMsgNo) return;
      clearTimeout(timer);
      unsubscribe?.();
      if (ev.reasonCode !== MessageReasonCode.reasonSuccess) {
        reject(new Error(reasonCodeToMessage(ev.reasonCode)));
        return;
      }
      resolve({
        messageId: ev.messageId,
        messageSeq: ev.messageSeq,
        fileContent,
      });
    });
  });
}

export async function sendVoice(
  channelId: string,
  channelType: number,
  blob: Blob,
  durationSec: number,
): Promise<string> {
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
  const { url } = await uploadAttachment(file, channelId, channelType);
  const data: VoiceContent = { url, timeTrad: Math.max(1, Math.round(durationSec)) };
  return imSendMessage({
    channelId,
    channelType,
    content: { type: MessageContentType.voice, data },
  });
}

export async function sendSticker(
  channelId: string,
  channelType: number,
  sticker: { path: string; placeholder: string; format: string; category: string },
): Promise<string> {
  const data: LottieStickerContent = {
    url: sticker.path,
    placeholder: sticker.placeholder,
    format: sticker.format,
    category: sticker.category,
  };
  return imSendMessage({
    channelId,
    channelType,
    content: { type: MessageContentType.lottieSticker, data },
  });
}
