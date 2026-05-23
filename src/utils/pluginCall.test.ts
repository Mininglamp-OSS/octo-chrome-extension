import { describe, expect, it } from "vitest";
import { normalizePluginCall } from "./pluginCall";

describe("normalizePluginCall", () => {
  describe("拒绝非法 payload", () => {
    it("payload 为 null / undefined / 字符串 → 拒绝", () => {
      expect(normalizePluginCall(null).ok).toBe(false);
      expect(normalizePluginCall(undefined).ok).toBe(false);
      expect(normalizePluginCall("hi").ok).toBe(false);
      expect(normalizePluginCall(123).ok).toBe(false);
    });

    it("type 不是 sendMessage → 拒绝", () => {
      const r = normalizePluginCall({ type: "closeMessage", value: "x" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("unsupported type");
    });

    it("type 缺失 → 拒绝", () => {
      const r = normalizePluginCall({ value: "x" });
      expect(r.ok).toBe(false);
    });

    it("value 不是 string → 拒绝", () => {
      const r = normalizePluginCall({ type: "sendMessage", value: 123 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("must be a string");
    });

    it("value 是空字符串或纯空白 → 拒绝", () => {
      expect(normalizePluginCall({ type: "sendMessage", value: "" }).ok).toBe(false);
      expect(normalizePluginCall({ type: "sendMessage", value: "   \n  " }).ok).toBe(false);
    });
  });

  describe("接受合法 payload", () => {
    it("中文文本", () => {
      const r = normalizePluginCall({
        type: "sendMessage",
        value: "你好世界",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.message).toEqual({
          type: "OCTO_PLUGIN_CALL",
          sub: "sendMessage",
          value: "你好世界",
        });
      }
    });

    it("不修剪 value 前后空白（保留原样投递）", () => {
      const r = normalizePluginCall({
        type: "sendMessage",
        value: "  hi  ",
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.message.value).toBe("  hi  ");
    });

    it("超长文本（>500 字）也接受", () => {
      const long = "a".repeat(2000);
      const r = normalizePluginCall({ type: "sendMessage", value: long });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.message.value.length).toBe(2000);
    });
  });
});
