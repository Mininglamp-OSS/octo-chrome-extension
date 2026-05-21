import { describe, expect, it } from "vitest";
import { getTitleColor, TITLE_COLORS } from "./titleColor";

describe("getTitleColor", () => {
  it("结果在调色板内", () => {
    expect(TITLE_COLORS).toContain(getTitleColor("alice"));
    expect(TITLE_COLORS).toContain(getTitleColor(""));
    expect(TITLE_COLORS).toContain(getTitleColor("张三李四"));
  });

  it("同输入同输出（确定性）", () => {
    expect(getTitleColor("alice")).toBe(getTitleColor("alice"));
  });
});
