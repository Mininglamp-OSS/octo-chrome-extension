import { describe, expect, it } from "vitest";
import { avatarGradient, getFirstChar, getInitials } from "./avatar";

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

describe("getInitials", () => {
  it("空串 → ?", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });

  it("中文取前 2 字", () => {
    expect(getInitials("都市青年")).toBe("都市");
    expect(getInitials("都江堰群")).toBe("都江");
    expect(getInitials("张三")).toBe("张三");
  });

  it("中文单字保留", () => {
    expect(getInitials("沈")).toBe("沈");
  });

  it("英文带空白 → 词首缩写", () => {
    expect(getInitials("Product Review")).toBe("PR");
    expect(getInitials("design system")).toBe("DS");
    expect(getInitials("a b c")).toBe("AB");
  });

  it("英文单词 → 前 2 字母大写", () => {
    expect(getInitials("alice")).toBe("AL");
    expect(getInitials("z")).toBe("Z");
  });

  it("数字保留", () => {
    expect(getInitials("9527")).toBe("95");
  });

  it("emoji 仅取首", () => {
    expect(getInitials("🔥hot")).toBe("🔥");
    expect(getInitials("👋")).toBe("👋");
  });

  it("max 参数生效", () => {
    expect(getInitials("ABCDE", 3)).toBe("ABC");
    expect(getInitials("张三李四", 3)).toBe("张三李");
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
