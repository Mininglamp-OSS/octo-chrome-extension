import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { type AppConfig, AppConfigSchema } from "../schemas/appConfig";

/**
 * 拉取 /v1/common/appconfig —— 主要用途是从 oidc_providers 拿 SSO provider 列表。
 * 5 分钟内不重复请求；未登录用户也能调（不带 token）。
 */
export function useAppConfig() {
  return useQuery({
    queryKey: ["appconfig"],
    staleTime: 5 * 60_000,
    async queryFn(): Promise<AppConfig> {
      const data = await api.get(Endpoints.appconfig).json();
      return AppConfigSchema.parse(data);
    },
  });
}
