import { QueryClient } from "@tanstack/react-query";

/**
 * 单例 QueryClient。
 *
 * 抽出来供非组件代码（im/client.ts 的 SDK listener、background message handler 等）
 * 直接读写 React Query 缓存，避免它们各自重新 new 一份导致缓存割裂。
 *
 * Provider 层（src/app/providers.tsx）引用这个同一实例。
 *
 * 默认值收敛：
 *  - staleTime 30s：常规列表 / 配置项不必频繁拉
 *  - gcTime 24h：必须 ≥ persistQueryClient 的 maxAge，否则 hydrate 后被立刻 GC
 *  - refetchOnWindowFocus: false：sidepanel 切换聚焦不要触发风暴
 *  - retry 1：网络抖动给一次机会
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
