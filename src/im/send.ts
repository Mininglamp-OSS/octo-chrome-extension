import { MessageContentType } from "@/const/message";
import { imSendMessage } from "@/im/proxy";
import { getImageDimensions, uploadAttachment } from "@/im/upload";
import type { FileContent } from "@/messages/file";
import type { ImageContent } from "@/messages/image";
import type { LottieStickerContent } from "@/messages/lottieSticker";
import type { TextContent } from "@/messages/text";
import type { VoiceContent } from "@/messages/voice";

export async function sendText(
  channelId: string,
  channelType: number,
  text: string,
  extra?: {
    mentionUids?: string[];
    mentionAll?: boolean;
    mentionEntities?: TextContent["mentionEntities"];
    replyInfo?: TextContent["replyInfo"];
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
