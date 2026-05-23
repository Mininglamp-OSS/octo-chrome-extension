import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { Toaster } from "@/components/ui/toast";
import { useApplyTheme } from "@/hooks/useApplyTheme";
import { usePreferencesStore } from "@/stores/preferences";
import { FilePreviewApp } from "./App";

/**
 * 预览页 boot —— 跟 AppBoot 比刻意精简：
 * - 不启动 IM 长连接（预览页跟消息流无关）
 * - 不持久化 react-query（预览页不发 query）
 * 只 hydrate prefs/theme，让 dark class 和 layout 跟其它 entry 一致。
 */
function PreviewBoot({ children }: { children: React.ReactNode }) {
  useApplyTheme();
  const [ready, setReady] = useState(false);
  const hydrate = usePreferencesStore((s) => s.hydrate);
  const subscribe = usePreferencesStore((s) => s.subscribe);

  useEffect(() => {
    let cancelled = false;
    void hydrate().finally(() => {
      if (!cancelled) setReady(true);
    });
    const off = subscribe();
    return () => {
      cancelled = true;
      off();
    };
  }, [hydrate, subscribe]);

  if (!ready) return null;
  return <>{children}</>;
}

const container = document.getElementById("root");
if (!container) throw new Error("missing #root");

// Guard：dev 模式下 wxt HMR 可能让本模块重跑，导致 createRoot 在同一 container 上调用两次
// → 两份 React tree 同时挂载、UI 渲染两份。把 root 挂在 container 上做幂等。
const cache = container as HTMLElement & { __reactRoot?: ReturnType<typeof createRoot> };
const reactRoot = cache.__reactRoot ?? createRoot(container);
cache.__reactRoot = reactRoot;

reactRoot.render(
  <StrictMode>
    <PreviewBoot>
      <FilePreviewApp />
      <Toaster />
    </PreviewBoot>
  </StrictMode>,
);
