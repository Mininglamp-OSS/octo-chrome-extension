import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { type Me, MeSchema } from "../schemas/auth";

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["auth", "logout"],
    async mutationFn() {
      try {
        await api.post(Endpoints.logout).json();
      } catch {
        // 即使后端登出失败也要清本地
      }
    },
    async onSuccess() {
      // 先清 react-query cache，再翻 auth 状态。
      // 反过来的话，clear() 触发 Gate 切到 LoginPage，LoginPage 的 useAppConfig
      // 会发起 fetch；紧接着的 qc.clear() 又把这条 query 清掉，observer 滞留
      // 在 fetchStatus=idle 状态，isPending 永远是 true，登录按钮的 skeleton 卡住。
      qc.clear();
      await clear();
    },
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ["auth", "me"],
    enabled,
    async queryFn(): Promise<Me> {
      const data = await api.get(Endpoints.me).json();
      return MeSchema.parse(data);
    },
  });
}
