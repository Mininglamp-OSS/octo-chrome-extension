import { deviceIdStorage } from "./storage";

/**
 * 设备信息 —— 登录时用，后端期望 `flag: number` 和 `device: { device_id, device_name, device_model }`。
 * 与 mirror App.tsx 中的 getDeviceIdFromStorage / getOSAndVersion / getBrandsFromUserAgent 行为对齐，
 * 但落盘改用 wxt-storage，避免直接依赖 localStorage。
 */

export interface DeviceInfo {
  device_id: string;
  device_name: string;
  device_model: string;
}

/** 浏览器扩展默认走 deviceFlag = 1（与 mirror requestLoginWithUsernameAndPwd 一致） */
export const DEVICE_FLAG = 1;

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // biome-ignore lint/style/noNonNullAssertion: fixed-length Uint8Array indexing
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  // biome-ignore lint/style/noNonNullAssertion: fixed-length Uint8Array indexing
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function ensureDeviceId(): Promise<string> {
  const existing = await deviceIdStorage.getValue();
  if (existing) return existing;
  const fresh = generateUUID();
  await deviceIdStorage.setValue(fresh);
  return fresh;
}

function getOSAndVersion(): string {
  if (typeof navigator === "undefined") return "Unknown OS";
  const ua = navigator.userAgent;
  if (/Windows NT (\d+\.\d+)/i.test(ua)) {
    const v = ua.match(/Windows NT (\d+\.\d+)/i)?.[1] ?? "unknown";
    return `Windows ${v}`;
  }
  if (/Mac OS X (\d+_\d+(_\d+)?)/i.test(ua)) {
    const v = ua.match(/Mac OS X (\d+_\d+(_\d+)?)/i)?.[1]?.replace(/_/g, ".") ?? "unknown";
    return `MacOS ${v}`;
  }
  if (/Android (\d+(\.\d+)?)/i.test(ua)) {
    const v = ua.match(/Android (\d+(\.\d+)?)/i)?.[1] ?? "unknown";
    return `Android ${v}`;
  }
  if (/CPU (iPhone )?OS (\d+_\d+(_\d+)?)/i.test(ua)) {
    const v = ua.match(/CPU (iPhone )?OS (\d+_\d+(_\d+)?)/i)?.[2]?.replace(/_/g, ".") ?? "unknown";
    return `iOS ${v}`;
  }
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown OS";
}

function getBrandFromUserAgent(): string {
  if (typeof navigator === "undefined") return "Unknown browser";
  const ua = navigator.userAgent;
  if (/Edg\/(\d+)/i.test(ua)) return `Edge ${ua.match(/Edg\/(\d+)/i)?.[1] ?? ""}`.trim();
  if (/Chrome\/(\d+)/i.test(ua)) return `Chrome ${ua.match(/Chrome\/(\d+)/i)?.[1] ?? ""}`.trim();
  if (/Firefox\/(\d+)/i.test(ua)) return `Firefox ${ua.match(/Firefox\/(\d+)/i)?.[1] ?? ""}`.trim();
  if (/Safari\/(\d+)/i.test(ua) && !/Chrome/i.test(ua))
    return `Safari ${ua.match(/Version\/(\d+)/i)?.[1] ?? ""}`.trim();
  return "Unknown browser";
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  return {
    device_id: await ensureDeviceId(),
    device_name: getOSAndVersion(),
    device_model: getBrandFromUserAgent(),
  };
}
