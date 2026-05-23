import {
  type PersistedClient,
  type Persister,
  PersistQueryClientProvider,
} from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import type * as React from "react";
import { queryClient } from "@/api/queryClient";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

const IDB_KEY = "octo-rq-cache" as const;

/**
 * IDB-backed persister，跨 entrypoint（sidepanel / cmdk / options）共享。
 * 同一个扩展 origin 下所有 entrypoint 共享 IndexedDB。
 */
const idbPersister: Persister = {
  persistClient: async (client) => {
    try {
      await set(IDB_KEY, client);
    } catch {
      // ignore: 容量超限 / 私密模式禁用 IDB 等
    }
  },
  restoreClient: async () => {
    try {
      return (await get<PersistedClient>(IDB_KEY)) ?? undefined;
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await del(IDB_KEY);
    } catch {
      // ignore
    }
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: idbPersister,
        maxAge: 24 * 60 * 60_000, // 24h
        // 只 persist 可复用的「频道元数据」与「成员列表」类查询。
        // IM 实时数据、未读、消息列表等不持久化（应每次重新拉）。
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => {
            const k0 = q.queryKey[0];
            return k0 === "channel" || k0 === "members" || k0 === "bots" || k0 === "friends";
          },
        },
      }}
    >
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster />
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}
