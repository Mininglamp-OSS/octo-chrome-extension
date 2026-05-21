import { api } from "../client";
import { Endpoints } from "../endpoints";
import {
  AuthcodeResponseSchema,
  type AuthStatusResponse,
  AuthStatusResponseSchema,
} from "../schemas/sso";

/** 拿一次性 authcode（5 min TTL），跳 IdP 与轮询 authstatus 共用 */
export async function fetchAuthcode(): Promise<string> {
  const data = await api.get(Endpoints.thirdloginAuthcode).json();
  return AuthcodeResponseSchema.parse(data).authcode;
}

/**
 * 查询单次 SSO 状态。
 * status: 0=pending, 1=success（result 必有）, 2=fail（msg 描述原因）。
 */
export async function fetchAuthStatus(authcode: string): Promise<AuthStatusResponse> {
  const data = await api
    .get(Endpoints.thirdloginAuthstatus, { searchParams: { authcode } })
    .json();
  return AuthStatusResponseSchema.parse(data);
}
