import { describe, expect, it } from "vitest";
import { avatarGradient, getFirstChar } from "./avatar";

describe("getFirstChar", () => {
  it("空串 → ?", () => {
    expect(getFirstChar("")).toBe("?");
  });

  it("英文字母大写化", () => {
    expect(getFirstChar("alice")).toBe("A");
    expect(getFirstChar("z")).toBe("Z");
  });

  it("数字保留", () => {
    expect(getFirstChar("9527")).toBe("9");
  });

  it("中文取首字", () => {
    expect(getFirstChar("张三")).toBe("张");
  });

  it("emoji 取首 grapheme", () => {
    const ch = getFirstChar("👋hi");
    expect(ch).toBe("👋");
  });
});

describe("avatarGradient", () => {
  it("同名同结果", () => {
    expect(avatarGradient("alice")).toBe(avatarGradient("alice"));
  });

  it("不同名不同结果", () => {
    expect(avatarGradient("alice")).not.toBe(avatarGradient("bob"));
  });

  it("产物形如 linear-gradient", () => {
    expect(avatarGradient("alice")).toMatch(/^linear-gradient\(135deg, hsl\(/);
  });
});
