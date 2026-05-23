import { describe, expect, it } from "vitest";
import {
  buildSelectionMarkdownFile,
  formatTimestamp,
  sanitizeForFilename,
} from "./buildSelectionMarkdownFile";

describe("sanitizeForFilename", () => {
  it("去掉 \\ / : * ? \" < > | 等非法字符", () => {
    expect(sanitizeForFilename(`a/b\\c:d*e?f"g<h>i|j`)).toBe("abcdefghij");
  });

  it("空白合并、首尾去空格", () => {
    expect(sanitizeForFilename("  hello   world  ")).toBe("hello world");
  });

  it("保留中文 / emoji", () => {
    expect(sanitizeForFilename("你好👋世界")).toBe("你好👋世界");
  });

  it("最长 40 字符", () => {
    const long = "x".repeat(80);
    expect(sanitizeForFilename(long).length).toBe(40);
  });
});

describe("formatTimestamp", () => {
  it("YYYYMMDD-HHmmss 零补", () => {
    expect(formatTimestamp(new Date(2024, 0, 5, 9, 3, 7))).toBe("20240105-090307");
  });
});

describe("buildSelectionMarkdownFile", () => {
  it("文件名形如 <title>-<ts>.md，type=text/markdown", () => {
    const f = buildSelectionMarkdownFile({
      selectedText: "body",
      pageUrl: "https://e.com",
      pageTitle: "Hello",
      hostname: "e.com",
    });
    expect(f.name).toMatch(/^Hello-\d{8}-\d{6}\.md$/);
    expect(f.type).toBe("text/markdown");
  });

  it("正文以「来自 🌐 [title](url)」开头 + --- 分隔 + selectedText", async () => {
    const f = buildSelectionMarkdownFile({
      selectedText: "abc\ndef",
      pageUrl: "https://e.com",
      pageTitle: "T",
      hostname: "e.com",
    });
    const text = await f.text();
    expect(text).toBe("来自 🌐 [T](https://e.com)\n\n---\n\nabc\ndef\n");
  });

  it("无 url 时来源行不带链接语法", async () => {
    const f = buildSelectionMarkdownFile({
      selectedText: "abc",
      pageUrl: "",
      pageTitle: "T",
      hostname: "h",
    });
    const text = await f.text();
    expect(text.startsWith("来自 🌐 T\n")).toBe(true);
  });

  it("title 与 hostname 都空时文件名兜底为 selection-…", () => {
    const f = buildSelectionMarkdownFile({
      selectedText: "x",
      pageUrl: "",
      pageTitle: "",
      hostname: "",
    });
    expect(f.name.startsWith("selection-")).toBe(true);
  });
});
