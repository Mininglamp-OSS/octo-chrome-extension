/**
 * SSO/OIDC 客户端核心（background SW 调度）。
 *
 * 流程（全在 background 驱动）：
 *  1. fetchAuthcode 拿 authcode
 *  2. browser.windows.create popup，URL = ${WEB_ORIGIN}${authorize_path}?authcode=...&return_to=${WEB_ORIGIN}/login&flag=2
 *  3. pollAuthStatus 轮询 → status=1 拿到 token；同时 popup 在 IdP 上完成登录会跳回 web /login（占位页，被 background 关闭）
 *
 * 后端校验 return_to scheme 只接受 https，所以 chrome-extension://... 不能用。
 * 扩展端不需要承接 callback：直接由 background 持有 authcode 并轮询拿结果。
 */

import { fetchAuthStatus } from "@/api/queries/sso";
import { getApiUrl } from "@/api/url";

export const OIDC_POLL_INTERVAL_MS = 800;
export const OIDC_POLL_TIMEOUT_MS = 5 * 60_000;

/** Web origin = API origin（API base 形如 https://im.deepminer.com.cn/api/v1/） */
export function getWebOrigin(): string {
  return new URL(getApiUrl()).origin;
}

/**
 * 构造 IdP 授权跳转 URL：
 *   {WEB_ORIGIN}{authorize_path}?authcode=...&return_to=...&flag=2
 *
 * - flag=2 表示扩展端（与 web 端 flag=1 区分）
 * - return_to 必须是 https（chrome-extension:// 会被后端拒）
 * - authorize_path 必须以 "/" 开头，防 open redirect
 */
export function buildAuthorizeUrl(args: {
  authorizePath: string;
  authcode: string;
  returnTo: string;
  flag?: number;
}): string {
  if (!args.authorizePath.startsWith("/")) {
    throw new Error(`unsafe authorize_path: ${args.authorizePath}`);
  }
  if (!args.returnTo.startsWith("https://") && !args.returnTo.startsWith("http://")) {
    throw new Error(`return_to must be http(s): ${args.returnTo}`);
  }
  const base = `${getWebOrigin()}${args.authorizePath}`;
  const url = new URL(base);
  url.searchParams.set("authcode", args.authcode);
  url.searchParams.set("return_to", args.returnTo);
  url.searchParams.set("flag", String(args.flag ?? 2));
  return url.toString();
}

export interface PollHandle {
  cancel(): void;
}

export interface PollResult {
  ok: boolean;
  /** ok=true 时一定有 */
  result?: import("@/api/schemas/sso").AuthStatusResult;
  /** ok=false 时的原因 */
  errorMsg?: string;
  /** 是否因超时退出 */
  timedOut?: boolean;
}

/**
 * 轮询 authstatus 直到 status=1 / status=2 / 超时 / 取消。status=0 视为 pending 继续。
 */
export function pollAuthStatus(
  authcode: string,
  opts: {
    intervalMs?: number;
    timeoutMs?: number;
    onTick?: () => void;
  } = {},
): { promise: Promise<PollResult>; handle: PollHandle } {
  const intervalMs = opts.intervalMs ?? OIDC_POLL_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? OIDC_POLL_TIMEOUT_MS;
  let cancelled = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolveOuter: ((r: PollResult) => void) | null = null;

  const settle = (r: PollResult): void => {
    if (settled) return;
    settled = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    resolveOuter?.(r);
  };

  const handle: PollHandle = {
    cancel() {
      cancelled = true;
      settle({ ok: false, errorMsg: "已取消" });
    },
  };

  const deadline = Date.now() + timeoutMs;

  const promise = new Promise<PollResult>((resolve) => {
    resolveOuter = resolve;
    const tick = async (): Promise<void> => {
      if (cancelled || settled) return;
      opts.onTick?.();
      try {
        const resp = await fetchAuthStatus(authcode);
        if (cancelled || settled) return;
        if (resp.status === 1 && resp.result) {
          return settle({ ok: true, result: resp.result });
        }
        if (resp.status === 2) {
          return settle({ ok: false, errorMsg: resp.msg ?? "登录失败" });
        }
        // status=0 pending；继续
      } catch (err) {
        if (cancelled || settled) return;
        // 网络抖动等可恢复错误：保留重试机会，直到超时
        console.debug("[octo:sso] authstatus poll error", err);
      }
      if (Date.now() >= deadline) {
        return settle({ ok: false, timedOut: true, errorMsg: "登录超时，请重试" });
      }
      timer = setTimeout(tick, intervalMs);
    };
    void tick();
  });

  return { promise, handle };
}
