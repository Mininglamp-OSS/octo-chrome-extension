import ky, { type KyInstance } from "ky";
import { useAuthStore } from "@/stores/auth";
import { useSpaceStore } from "@/stores/space";
import { getApiUrl, setApiUrl as setApiUrlInternal } from "./url";

export { getApiUrl } from "./url";

export class APIError extends Error {
  public readonly status: number;
  public readonly originCause?: unknown;

  constructor(message: string, status: number, cause?: unknown) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.originCause = cause;
  }

  /** 兼容 extractErrorMsg 字段名 */
  get msg(): string {
    return this.message;
  }
}

function resolveBackendMsg(body: unknown): string | null {
  if (body && typeof body === "object" && "msg" in body) {
    const m = (body as { msg: unknown }).msg;
    if (typeof m === "string" && m.length > 0) return m.slice(0, 200);
  }
  return null;
}

export function setApiUrl(url: string): void {
  setApiUrlInternal(url);
  api = build();
}

function build(): KyInstance {
  return ky.create({
    prefixUrl: getApiUrl(),
    timeout: 15_000,
    retry: { limit: 1, methods: ["get"] },
    hooks: {
      beforeRequest: [
        (request) => {
          const token = useAuthStore.getState().state?.token;
          if (token) request.headers.set("token", token);
          const spaceId = useSpaceStore.getState().currentSpaceId;
          if (spaceId) request.headers.set("X-Space-Id", spaceId);
        },
      ],
      beforeError: [
        async (error) => {
          const { response } = error;
          let backendMsg: string | null = null;
          if (response) {
            try {
              const body = await response.clone().json();
              backendMsg = resolveBackendMsg(body);
            } catch {
              // 非 JSON 响应
            }
          }
          const status = response?.status ?? 0;
          let msg: string;
          switch (status) {
            case 400:
              msg = backendMsg ?? "请求参数错误";
              break;
            case 401:
              msg = backendMsg ?? "登录已过期，请重新登录";
              void useAuthStore.getState().clear();
              break;
            case 404:
              msg = backendMsg ?? "请求地址没有找到（404）";
              break;
            default:
              msg = backendMsg ?? "未知错误";
          }
          // 把 ky HTTPError 的 message 替换成可读 msg，cause 保留原 error
          error.message = msg;
          (error as unknown as { msg: string }).msg = msg;
          return error;
        },
      ],
    },
  });
}

export let api: KyInstance = build();
