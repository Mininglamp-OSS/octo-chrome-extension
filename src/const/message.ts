/**
 * 消息类型常量 / 枚举 —— `MessageContentType` 已迁到 registry 自动派生。
 * 这里保留 wukongim 协议常量（与具体类型无关）。
 */
export { MessageContentType } from "@/messages/core/registry";

/** wukongim 服务端发包失败原因码 */
export enum MessageReasonCode {
  reasonUnknown = 0,
  reasonSuccess = 1,
  reasonAuthFail = 2,
  reasonSubscriberNotExist = 3,
  reasonInBlacklist = 4,
  reasonChannelNotExist = 5,
  reasonUserNotOnNode = 6,
  reasonSenderOffline = 7,
  reasonMsgKeyError = 8,
  reasonPayloadDecodeError = 9,
  reasonForwardSendPacketError = 10,
  reasonNotAllowSend = 11,
  reasonConnectKick = 12,
  reasonNotInWhitelist = 13,
  reasonQueryTokenError = 14,
  reasonSystemError = 15,
}

/** 会话排序权重因子（与 mirror 一致） */
export const ORDER_FACTOR = 10000;
