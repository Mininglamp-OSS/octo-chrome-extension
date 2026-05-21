import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/url", () => ({
  getApiUrl: () => "https://im.deepminer.com.cn/api/v1/",
}));
vi.mock("@/api/queries/sso", () => ({
  fetchAuthStatus: vi.fn(),
}));

import { fetchAuthStatus } from "@/api/queries/sso";
import type { AuthStatusResponse } from "@/api/schemas/sso";
import { buildAuthorizeUrl, getWebOrigin, pollAuthStatus } from "./oidc";

const mockedFetchAuthStatus = fetchAuthStatus as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedFetchAuthStatus.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getWebOrigin", () => {
  it("从 api base 推断 origin", () => {
    expect(getWebOrigin()).toBe("https://im.deepminer.com.cn");
  });
});

describe("buildAuthorizeUrl", () => {
  it("拼接完整 URL", () => {
    const url = buildAuthorizeUrl({
      authorizePath: "/sso/authorize",
      authcode: "abc123",
      returnTo: "https://im.deepminer.com.cn/login",
    });
    const u = new URL(url);
    expect(u.origin).toBe("https://im.deepminer.com.cn");
    expect(u.pathname).toBe("/sso/authorize");
    expect(u.searchParams.get("authcode")).toBe("abc123");
    expect(u.searchParams.get("return_to")).toBe("https://im.deepminer.com.cn/login");
    expect(u.searchParams.get("flag")).toBe("2");
  });

  it("authorize_path 非 / 开头 → 抛错（防 open redirect）", () => {
    expect(() =>
      buildAuthorizeUrl({
        authorizePath: "https://evil.com/sso",
        authcode: "x",
        returnTo: "https://im.deepminer.com.cn/login",
      }),
    ).toThrow();
  });

  it("return_to 非 https → 抛错（后端拒 chrome-extension://）", () => {
    expect(() =>
      buildAuthorizeUrl({
        authorizePath: "/sso/authorize",
        authcode: "x",
        returnTo: "chrome-extension://xxx/sso.html",
      }),
    ).toThrow();
  });
});

describe("pollAuthStatus", () => {
  it("status=1 → 立刻 resolve ok", async () => {
    mockedFetchAuthStatus.mockResolvedValueOnce({
      status: 1,
      result: { uid: "u1", token: "t1", name: "Alice" },
    } satisfies AuthStatusResponse);
    const { promise } = pollAuthStatus("code1", { intervalMs: 1, timeoutMs: 1_000 });
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(res.result?.uid).toBe("u1");
  });

  it("status=2 → resolve fail，带 msg", async () => {
    mockedFetchAuthStatus.mockResolvedValueOnce({
      status: 2,
      msg: "用户拒绝",
    } satisfies AuthStatusResponse);
    const { promise } = pollAuthStatus("code1", { intervalMs: 1, timeoutMs: 1_000 });
    const res = await promise;
    expect(res.ok).toBe(false);
    expect(res.errorMsg).toBe("用户拒绝");
  });

  it("先 pending 后 success", async () => {
    mockedFetchAuthStatus
      .mockResolvedValueOnce({ status: 0 } satisfies AuthStatusResponse)
      .mockResolvedValueOnce({
        status: 1,
        result: { uid: "u1", token: "t1" },
      } satisfies AuthStatusResponse);
    const { promise } = pollAuthStatus("code1", { intervalMs: 1, timeoutMs: 1_000 });
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(mockedFetchAuthStatus).toHaveBeenCalledTimes(2);
  });

  it("超时 → timedOut=true", async () => {
    mockedFetchAuthStatus.mockResolvedValue({ status: 0 } satisfies AuthStatusResponse);
    const { promise } = pollAuthStatus("code1", { intervalMs: 5, timeoutMs: 20 });
    const res = await promise;
    expect(res.ok).toBe(false);
    expect(res.timedOut).toBe(true);
  });

  it("cancel() → 中止", async () => {
    mockedFetchAuthStatus.mockResolvedValue({ status: 0 } satisfies AuthStatusResponse);
    const { promise, handle } = pollAuthStatus("code1", { intervalMs: 10, timeoutMs: 1_000 });
    setTimeout(() => handle.cancel(), 5);
    const res = await promise;
    expect(res.ok).toBe(false);
    expect(res.errorMsg).toBe("已取消");
  });
});
