import { describe, expect, it } from "vitest";
import { extractErrorMsg } from "./extractErrorMsg";

describe("extractErrorMsg", () => {
  it("从 {msg} 提取", () => {
    expect(extractErrorMsg({ msg: "已断开" })).toBe("已断开");
  });

  it("回退到 {message}", () => {
    expect(extractErrorMsg(new Error("boom"))).toBe("boom");
  });

  it("非 string msg 忽略", () => {
    expect(extractErrorMsg({ msg: 42 })).toBe("");
  });

  it("null/undefined → 空串", () => {
    expect(extractErrorMsg(null)).toBe("");
    expect(extractErrorMsg(undefined)).toBe("");
  });
});
