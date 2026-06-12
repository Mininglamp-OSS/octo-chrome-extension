/**
 * postMessage 收信侧来源校验纯函数集合。
 *
 * 抽成纯函数以便 unit test —— 各 content script / iframe app 的 message 监听器
 * 复用同一判定，保证「恶意兄弟 iframe / 跨源页面伪造的 postMessage」被一致拦截：
 * 既收不到敏感数据（选区文本），也打不进伪造控制消息（CONTEXT / READY / DONE）。
 */

/**
 * 同帧同源消息：source 必须是本 window 自己，且 origin 等于本帧 origin。
 * 用于 main world ↔ isolated world 同帧桥接（qq-doc 选区、pluginCall）。
 */
export function isSameWindowMessage(
  source: MessageEventSource | null,
  origin: string,
  selfWindow: Window,
  selfOrigin: string,
): boolean {
  return source === selfWindow && origin === selfOrigin;
}

/**
 * 来自指定 window（父帧或某个子 iframe）的消息。
 * expected 为空（如 iframe 尚未挂载 contentWindow）时一律拒绝。
 */
export function isFromWindow(
  source: MessageEventSource | null,
  expected: Window | null | undefined,
): boolean {
  return expected != null && source === expected;
}

/**
 * 从 document.referrer 推导父帧 origin，用作向父帧 postMessage 的 targetOrigin。
 * referrer 为空或非法时返回 null —— 调用方据此跳过发送，绝不退化为 "*"。
 * cmdk iframe 恒由父页面加载，正常情况下 referrer 必有值。
 */
export function originFromReferrer(referrer: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).origin;
  } catch {
    return null;
  }
}
