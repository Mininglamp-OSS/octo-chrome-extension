import { describe, expect, it } from "vitest";
import { buildThreadChannelId, isThreadChannelId, parseThreadChannelId } from "./thread";

describe("parseThreadChannelId", () => {
  it("正常 parent:thread", () => {
    expect(parseThreadChannelId("g1:t1")).toEqual({ parent: "g1", thread: "t1" });
  });

  it("无分隔符返回 null", () => {
    expect(parseThreadChannelId("g1t1")).toBeNull();
  });

  it("空段返回 null", () => {
    expect(parseThreadChannelId(":t1")).toBeNull();
    expect(parseThreadChannelId("g1:")).toBeNull();
  });

  it("多冒号只切第一个", () => {
    expect(parseThreadChannelId("g1:t1:extra")).toEqual({ parent: "g1", thread: "t1:extra" });
  });
});

describe("buildThreadChannelId / isThreadChannelId", () => {
  it("互逆", () => {
    const built = buildThreadChannelId("g1", "t1");
    expect(built).toBe("g1:t1");
    expect(isThreadChannelId(built)).toBe(true);
    expect(parseThreadChannelId(built)).toEqual({ parent: "g1", thread: "t1" });
  });

  it("非 thread channel", () => {
    expect(isThreadChannelId("g1")).toBe(false);
  });
});
