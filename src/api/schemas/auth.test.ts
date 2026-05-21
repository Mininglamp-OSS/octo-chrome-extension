import { describe, expect, it } from "vitest";
import { LoginResponseSchema } from "./auth";

describe("LoginResponseSchema", () => {
  it("最小响应", () => {
    expect(LoginResponseSchema.parse({ uid: "u1", token: "t1" })).toEqual({
      uid: "u1",
      token: "t1",
    });
  });

  it("完整响应", () => {
    const out = LoginResponseSchema.parse({
      uid: "u1",
      token: "t1",
      name: "Alice",
      short_no: "9527",
      sex: 1,
      role: "user",
    });
    expect(out.name).toBe("Alice");
    expect(out.short_no).toBe("9527");
  });

  it("缺少 uid → 抛错", () => {
    expect(() => LoginResponseSchema.parse({ token: "t1" })).toThrow();
  });
});
