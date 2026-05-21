import { describe, expect, it } from "vitest";
import { MeSchema } from "./auth";

describe("MeSchema", () => {
  it("最小响应", () => {
    expect(MeSchema.parse({ uid: "u1" })).toEqual({ uid: "u1" });
  });

  it("完整响应", () => {
    const out = MeSchema.parse({
      uid: "u1",
      name: "Alice",
      short_no: "9527",
      sex: 1,
      role: "user",
    });
    expect(out.name).toBe("Alice");
    expect(out.short_no).toBe("9527");
  });

  it("缺少 uid → 抛错", () => {
    expect(() => MeSchema.parse({ name: "x" })).toThrow();
  });
});
