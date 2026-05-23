import { describe, expect, it } from "vitest";
import { getThreadHueColor, getTitleColor, TITLE_COLORS } from "./titleColor";

describe("getTitleColor", () => {
  it("结果在调色板内", () => {
    expect(TITLE_COLORS).toContain(getTitleColor("alice"));
    expect(TITLE_COLORS).toContain(getTitleColor(""));
    expect(TITLE_COLORS).toContain(getTitleColor("张三李四"));
  });

  it("同输入同输出（确定性）", () => {
    expect(getTitleColor("alice")).toBe(getTitleColor("alice"));
  });

  it("同首字不同名 → 不应必然撞色", () => {
    // 这是新 hash 算法的核心保证：避免「都市青年 / 都江堰群 / 都灵之夜」全部
    // 走相同 hash 路径前缀。理论上 50 色仍可能撞，但同首字三连撞概率极低。
    const a = getTitleColor("都市青年");
    const b = getTitleColor("都江堰群");
    const c = getTitleColor("都灵之夜");
    const distinct = new Set([a, b, c]);
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });
});

describe("getThreadHueColor", () => {
  it("结果在 6 色子区色板内", () => {
    const palette = ["#7C5CFC", "#5979F0", "#5FB05F", "#3E9CCB", "#C8697D", "#C49B4B"];
    expect(palette).toContain(getThreadHueColor("PR周会"));
    expect(palette).toContain(getThreadHueColor(""));
  });

  it("不会返回 mention 橙", () => {
    for (const name of ["a", "b", "需求", "技术", "PR周会", "讨论"]) {
      expect(getThreadHueColor(name)).not.toBe("#F97316");
    }
  });

  it("同输入同输出", () => {
    expect(getThreadHueColor("PR周会")).toBe(getThreadHueColor("PR周会"));
  });
});
