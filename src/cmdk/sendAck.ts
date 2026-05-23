export const SEND_ACK_TIMEOUT = 12_000;

export class SendAckTimeoutError extends Error {
  constructor() {
    super("发送超时，请检查网络后重试");
    this.name = "SendAckTimeoutError";
  }
}

/**
 * 给一次发送 promise 加超时兜底。
 *
 * octo-ext 的 sendText/sendImage/sendFile 走 imSendMessage（offscreen RPC），
 * SendAck 在 offscreen 那一侧已经被 SDK chatManager 收掉，client 侧拿到的只是
 * 「RPC 已派发」的 message ID。本方法只在 RPC 整体超过 12s 不返回时报「发送超时」。
 */
export function withSendAck<T>(
  promise: Promise<T>,
  timeoutMs = SEND_ACK_TIMEOUT,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timer = null;
      reject(new SendAckTimeoutError());
    }, timeoutMs);
    promise.then(
      (v) => {
        if (timer) clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (timer) clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * 把发送错误整理成给用户看的简短提示。
 * 优先级：SendAckTimeoutError → err.msg / err.message → 兜底「发送失败」。
 */
export function getSendErrorMessage(err: unknown, fallback = "发送失败"): string {
  if (err instanceof SendAckTimeoutError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const m = (err as { msg?: unknown; message?: unknown }).msg;
    if (typeof m === "string" && m) return m;
    const m2 = (err as { message?: unknown }).message;
    if (typeof m2 === "string" && m2) return m2;
  }
  return fallback;
}
