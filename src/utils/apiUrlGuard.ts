/**
 * 自定义 API 端点地址校验（纯函数，便于 unit test）。
 *
 * 威胁模型：设置页允许用户改写 API base URL，而登录凭证会随每个请求发往该地址。
 * 若放任填入任意地址，攻击者可诱导用户把 endpoint 指向自己的服务器窃取凭证。
 *
 * 策略：
 * - 默认域 + 显式允许列表 = 可信域，直接保存（trusted）。
 * - 白名单外但 https → 允许，但需二次确认（untrusted，凭证外发风险提示）。
 * - 白名单外且非 https，或根本不是合法 URL → 直接拒绝（强制 https）。
 */

import { DEFAULT_API_URL } from "@/api/endpoints";

/**
 * 可信域后缀列表。后缀匹配（host === suffix 或 host 以 `.suffix` 结尾），不使用正则，
 * 避免 `evil-deepminer.com.cn` 这类伪造域绕过。默认 API 域永远在内。
 */
export const TRUSTED_HOST_SUFFIXES: readonly string[] = (() => {
  const suffixes = new Set<string>(["deepminer.com.cn"]);
  try {
    suffixes.add(new URL(DEFAULT_API_URL).hostname);
  } catch {
    // DEFAULT_API_URL 理论上恒合法；防御性兜底
  }
  return [...suffixes];
})();

/** 归一化 hostname：小写 + 去掉 FQDN 结尾的点（`a.com.` → `a.com`），避免误判。 */
function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

function isTrustedHost(hostname: string): boolean {
  const h = normalizeHostname(hostname);
  return TRUSTED_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

export type ApiUrlValidation =
  | { ok: true; trusted: boolean }
  | { ok: false; reason: string };

/**
 * 校验用户填入的 API 地址。
 * @param raw 用户输入（调用方应已 trim；空串视为「用默认地址」，由调用方放行，不传入这里）。
 */
export function validateApiUrl(raw: string): ApiUrlValidation {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "请输入合法的 URL（包含 http(s):// 协议）" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "仅支持 http(s):// 协议" };
  }

  // 凭证只走 https：任何自定义地址（含可信域）都强制 https，杜绝明文外发。
  if (url.protocol !== "https:") {
    return { ok: false, reason: "API 地址必须使用 https://" };
  }

  // https 且在可信列表 → 直接保存
  if (isTrustedHost(url.hostname)) {
    return { ok: true, trusted: true };
  }

  // 白名单外但 https → 允许但需二次确认
  return { ok: true, trusted: false };
}
