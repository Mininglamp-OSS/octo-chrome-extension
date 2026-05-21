import { describe, expect, it } from "vitest";
import { AppConfigSchema, OidcProviderSchema } from "./appConfig";

describe("OidcProviderSchema", () => {
  it("最小字段", () => {
    expect(
      OidcProviderSchema.parse({ id: "aegis", name: "Aegis", authorize_path: "/oauth" }),
    ).toMatchObject({ id: "aegis", name: "Aegis", authorize_path: "/oauth" });
  });

  it("缺少必填 → 抛错", () => {
    expect(() => OidcProviderSchema.parse({ id: "aegis", name: "Aegis" })).toThrow();
  });
});

describe("AppConfigSchema", () => {
  it("oidc_providers 缺失时填空数组", () => {
    const out = AppConfigSchema.parse({});
    expect(out.oidc_providers).toEqual([]);
  });

  it("透传未知字段", () => {
    const out = AppConfigSchema.parse({
      oidc_providers: [],
      app_name: "Octo",
      foo: { bar: 1 },
    });
    expect((out as Record<string, unknown>).app_name).toBe("Octo");
  });

  it("解析含 provider 列表", () => {
    const out = AppConfigSchema.parse({
      oidc_providers: [
        { id: "aegis", name: "Aegis", authorize_path: "/sso/authorize" },
        { id: "ldap", name: "LDAP", authorize_path: "/ldap/authorize" },
      ],
    });
    expect(out.oidc_providers).toHaveLength(2);
    expect(out.oidc_providers[0]!.id).toBe("aegis");
  });
});
