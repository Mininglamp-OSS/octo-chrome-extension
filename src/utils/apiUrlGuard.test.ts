import { describe, expect, it } from "vitest";
import { DEFAULT_API_URL } from "@/api/endpoints";
import { validateApiUrl } from "./apiUrlGuard";

describe("validateApiUrl", () => {
  it("默认 API 域 → 可信，直接保存（trusted）", () => {
    const r = validateApiUrl(DEFAULT_API_URL);
    expect(r).toEqual({ ok: true, trusted: true });
  });

  it("可信后缀子域（*.deepminer.com.cn）→ 可信", () => {
    const r = validateApiUrl("https://staging.im.deepminer.com.cn/api/v1/");
    expect(r).toEqual({ ok: true, trusted: true });
  });

  it("可信域 + 非默认端口 / FQDN 结尾点 → 仍可信（按 hostname 归一化判定）", () => {
    expect(validateApiUrl("https://im.deepminer.com.cn:8443/api/")).toEqual({
      ok: true,
      trusted: true,
    });
    expect(validateApiUrl("https://im.deepminer.com.cn./api/")).toEqual({
      ok: true,
      trusted: true,
    });
  });

  it("可信域但用 http → 拒绝（凭证强制 https，连可信域也不放明文）", () => {
    expect(validateApiUrl("http://im.deepminer.com.cn/api/").ok).toBe(false);
  });

  it("白名单外 https 域 → 允许但需二次确认（untrusted）", () => {
    const r = validateApiUrl("https://api.example.com/");
    expect(r).toEqual({ ok: true, trusted: false });
  });

  it("白名单外 http 域 → 拒绝（强制 https，改不进去）", () => {
    const r = validateApiUrl("http://api.example.com/");
    expect(r.ok).toBe(false);
  });

  it("非法 URL 串 → 拒绝（改不进去）", () => {
    expect(validateApiUrl("not a url").ok).toBe(false);
    expect(validateApiUrl("im.deepminer.com.cn").ok).toBe(false);
    expect(validateApiUrl("ftp://im.deepminer.com.cn/").ok).toBe(false);
  });

  it("伪造相似域（后缀不匹配）→ 不可信，需确认而非直接信任", () => {
    const r = validateApiUrl("https://evil-deepminer.com.cn/");
    expect(r).toEqual({ ok: true, trusted: false });
  });

  it("伪造域把可信串放在路径里 → 不可信", () => {
    const r = validateApiUrl("https://evil.example/im.deepminer.com.cn/api/");
    expect(r).toEqual({ ok: true, trusted: false });
  });
});
