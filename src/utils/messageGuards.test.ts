import { describe, expect, it } from "vitest";
import { isFromWindow, isSameWindowMessage, originFromReferrer } from "./messageGuards";

describe("messageGuards", () => {
  describe("isSameWindowMessage（同帧同源桥接：qq-doc 选区 / pluginCall）", () => {
    const self = {} as Window;
    const selfOrigin = "https://docs.qq.com";

    it("source 是本 window 且 origin 同源 → 接受", () => {
      expect(isSameWindowMessage(self, selfOrigin, self, selfOrigin)).toBe(true);
    });

    it("恶意 iframe（source ≠ window）→ 拒绝：收不到选区消息", () => {
      const evil = {} as Window;
      expect(isSameWindowMessage(evil, selfOrigin, self, selfOrigin)).toBe(false);
    });

    it("跨源伪造（origin 不同）→ 拒绝", () => {
      expect(isSameWindowMessage(self, "https://evil.example", self, selfOrigin)).toBe(false);
    });

    it("source 为 null → 拒绝", () => {
      expect(isSameWindowMessage(null, selfOrigin, self, selfOrigin)).toBe(false);
    });
  });

  describe("isFromWindow（来自指定父帧/子 iframe）", () => {
    const parent = {} as Window;

    it("source 等于期望 window → 接受", () => {
      expect(isFromWindow(parent, parent)).toBe(true);
    });

    it("source 是其他 window（伪造 CONTEXT/READY/DONE）→ 拒绝：打不进伪造消息", () => {
      const evil = {} as Window;
      expect(isFromWindow(evil, parent)).toBe(false);
    });

    it("期望 window 尚未挂载（null/undefined）→ 一律拒绝", () => {
      expect(isFromWindow(parent, null)).toBe(false);
      expect(isFromWindow(parent, undefined)).toBe(false);
    });

    it("source 为 null → 拒绝", () => {
      expect(isFromWindow(null, parent)).toBe(false);
    });
  });

  describe("originFromReferrer（向父帧 postMessage 的 targetOrigin 推导）", () => {
    it("合法 referrer → 返回 origin（不退化为通配）", () => {
      expect(originFromReferrer("https://docs.qq.com/doc/abc?x=1")).toBe("https://docs.qq.com");
    });

    it("referrer 为空 → 返回 null（调用方据此跳过发送）", () => {
      expect(originFromReferrer("")).toBeNull();
    });

    it("非法 referrer → 返回 null", () => {
      expect(originFromReferrer("not a url")).toBeNull();
    });
  });
});
