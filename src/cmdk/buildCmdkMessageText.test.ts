import { describe, expect, it } from "vitest";
import { buildCmdkMessageText } from "./buildCmdkMessageText";

describe("buildCmdkMessageText", () => {
  const ctx = {
    selectedText: "hello\nworld",
    pageUrl: "https://example.com/p",
    pageTitle: "Example",
    hostname: "example.com",
  };

  it("默认：source line + 多行 quote + user input", () => {
    const { content } = buildCmdkMessageText("nice", ctx);
    expect(content).toBe(
      "> 来自 🌐 [Example](https://example.com/p)\n> \n> hello\n> world\n\nnice",
    );
  });

  it("无用户输入只输出引用块", () => {
    const { content } = buildCmdkMessageText("   ", ctx);
    expect(content).toBe("> 来自 🌐 [Example](https://example.com/p)\n> \n> hello\n> world");
  });

  it("skipQuotedBody：仅 user input（来源 + 选段都已写入 md 文件，不复述）", () => {
    const { content } = buildCmdkMessageText("see file", ctx, { skipQuotedBody: true });
    expect(content).toBe("see file");
  });

  it("skipQuotedBody 且无用户输入：返回空串", () => {
    const { content } = buildCmdkMessageText("", ctx, { skipQuotedBody: true });
    expect(content).toBe("");
  });

  it("无 url 时仅 quote 选段", () => {
    const { content } = buildCmdkMessageText("comment", {
      selectedText: "abc",
      pageUrl: "",
      pageTitle: "",
      hostname: "",
    });
    expect(content).toBe("> abc\n\ncomment");
  });

  it("无 url 无选段：仅 user input", () => {
    const { content } = buildCmdkMessageText("hi", null);
    expect(content).toBe("hi");
  });

  it("title 缺失时 label 回落到 url", () => {
    const { content } = buildCmdkMessageText("", {
      selectedText: "",
      pageUrl: "https://x.com/y",
      pageTitle: "",
      hostname: "x.com",
    });
    expect(content).toContain("[https://x.com/y](https://x.com/y)");
  });
});
