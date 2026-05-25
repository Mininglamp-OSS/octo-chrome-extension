import { MessageReasonCode } from "@/const/message";

/** 客户端自定义 reasonCode：stub 在 10s 内没等到 sendack 升级 */
export const REASON_TIMEOUT = -1;
/** 客户端自定义 reasonCode：调用 imSendMessage 前 ws 已断 */
export const REASON_IM_NOT_CONNECTED = -2;

/**
 * 把 sendack reasonCode 翻译成给用户看的文案。
 *
 * 服务端枚举见 `MessageReasonCode`；本地自定义额外两个：
 * - REASON_TIMEOUT (-1)        ：sendack 超时（10s 没回）
 * - REASON_IM_NOT_CONNECTED (-2)：发送前 ws 未连接（快速失败）
 *
 * 没匹配上的码统一回退「发送失败 (reasonCode=N)」便于排错。
 */
export function reasonCodeToMessage(code: number | undefined): string {
  switch (code) {
    case REASON_IM_NOT_CONNECTED:
      return "IM 未连接，请检查网络后重试";
    case REASON_TIMEOUT:
      return "发送超时，请检查网络后重试";
    case MessageReasonCode.reasonAuthFail:
      return "登录已失效，请重新登录";
    case MessageReasonCode.reasonSubscriberNotExist:
      return "对方账号不存在";
    case MessageReasonCode.reasonInBlacklist:
      return "已被对方拉黑，无法发送";
    case MessageReasonCode.reasonChannelNotExist:
      return "频道不存在或已解散";
    case MessageReasonCode.reasonNotAllowSend:
      return "你已被禁言或没有发送权限";
    case MessageReasonCode.reasonConnectKick:
      return "连接已在其他端登录，无法发送";
    case MessageReasonCode.reasonNotInWhitelist:
      return "不在白名单内，无法发送";
    case MessageReasonCode.reasonQueryTokenError:
      return "登录态异常，请重新登录";
    case MessageReasonCode.reasonSystemError:
      return "服务端异常，请稍后重试";
    case undefined:
    case MessageReasonCode.reasonUnknown:
      return "发送失败";
    default:
      return `发送失败 (reasonCode=${code})`;
  }
}

/** 发送前快速失败：ws 未连接 */
export class ImNotConnectedError extends Error {
  readonly reasonCode = REASON_IM_NOT_CONNECTED;
  constructor() {
    super(reasonCodeToMessage(REASON_IM_NOT_CONNECTED));
    this.name = "ImNotConnectedError";
  }
}
