import { z } from "zod";

/**
 * OIDC provider 元数据（来自 GET /v1/common/appconfig 的 oidc_providers 字段）。
 * authorize_path 是相对路径（/...），扩展端跳转时需拼上 web origin（与 API host 同源）。
 */
export const OidcProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  authorize_path: z.string(),
  account_url: z.string().optional(),
  reset_password_url: z.string().optional(),
});
export type OidcProvider = z.infer<typeof OidcProviderSchema>;

export const AppConfigSchema = z
  .object({
    oidc_providers: z.array(OidcProviderSchema).default([]),
  })
  .passthrough();
export type AppConfig = z.infer<typeof AppConfigSchema>;
