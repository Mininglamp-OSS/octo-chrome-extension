/**
 * messages/ barrel —— 重定向到 registry。
 *
 * 历史导入 `import { TextMessage, MessageContentType } from "@/messages"` 仍然能用，
 * 但建议新代码直接 import 自 `@/messages/core/registry`。
 */

export type {
  AnyMessageModule,
  MessageCategory,
  MessageRenderCtx,
  MessageTypeModule,
} from "@/messages/core/defineMessageType";
export {
  allModules,
  getModule,
  getModuleOrUnknown,
  MESSAGE_TYPES,
  MessageContentType,
  type RegisteredModule,
  type SerializedContent,
} from "@/messages/core/registry";
export { FILE_TYPE, type FileContent, FileMessage } from "@/messages/file";
export { IMAGE_TYPE, type ImageContent, ImageMessage } from "@/messages/image";
export {
  LOTTIE_STICKER_TYPE,
  type LottieStickerContent,
  LottieStickerMessage,
} from "@/messages/lottieSticker";
export { TEXT_TYPE, type TextContent, TextMessage } from "@/messages/text";
export { VOICE_TYPE, type VoiceContent, VoiceMessage } from "@/messages/voice";
