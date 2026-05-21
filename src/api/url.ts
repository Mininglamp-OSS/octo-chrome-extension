import { DEFAULT_API_URL } from "./endpoints";

/**
 * apiUrl 的状态独立成单文件 —— 让 utils/url.ts 等纯工具能在不引入
 * stores/auth + wxt/storage 的前提下读到 base URL，避免 vitest node 环境
 * 因为 wxt 的 browser.runtime 缺失而抛 unhandled rejection。
 */
let apiUrl = DEFAULT_API_URL;

export function setApiUrl(url: string): void {
  apiUrl = url.endsWith("/") ? url : `${url}/`;
}

export function getApiUrl(): string {
  return apiUrl;
}
