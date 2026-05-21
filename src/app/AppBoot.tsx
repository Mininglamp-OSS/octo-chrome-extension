import { useEffect, useState } from "react";
import { setApiUrl } from "@/api/client";
import { DEFAULT_API_URL } from "@/api/endpoints";
import { useApplyTheme } from "@/hooks/useApplyTheme";
import { onImMessage, setupIm, startIm, stopIm } from "@/im/client";
import { toMessageView } from "@/im/message";
import { registerAllRenders } from "@/messages/renders";
import { sendMessage } from "@/platform/messaging";
import { selectIsLogined, useAuthStore } from "@/stores/auth";
import { useCurrentChannel } from "@/stores/currentChannel";
import { usePreferencesStore } from "@/stores/preferences";
import { useSpaceStore } from "@/stores/space";

// 模块加载即注册（每个 UI bundle 仅一次）
registerAllRenders();

/**
 * AppBoot —— 顶层副作用容器。
 *
 * 1. hydrate 所有持久化 store
 * 2. subscribe cross-context storage 变化
 * 3. 应用主题
 * 4. 把 prefs.apiUrl 同步到 ky 客户端
 * 5. 启动 IM 长连接（sidepanel 自持 SDK；mirror extension 同款模式）
 *
 * children 在 hydrate 完成前不渲染，避免闪烁。
 */
export function AppBoot({ children }: { children: React.ReactNode }) {
  useApplyTheme();
  const [ready, setReady] = useState(false);

  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateSpace = useSpaceStore((s) => s.hydrate);
  const hydratePrefs = usePreferencesStore((s) => s.hydrate);
  const hydrateChannel = useCurrentChannel((s) => s.hydrate);
  const subAuth = useAuthStore((s) => s.subscribe);
  const subSpace = useSpaceStore((s) => s.subscribe);
  const subPrefs = usePreferencesStore((s) => s.subscribe);
  const apiUrl = usePreferencesStore((s) => s.prefs.apiUrl);

  useEffect(() => {
    let cancelled = false;
    Promise.all([hydrateAuth(), hydrateSpace(), hydratePrefs(), hydrateChannel()])
      .catch(() => {
        // hydrate 内部各自有 fallback
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    const off1 = subAuth();
    const off2 = subSpace();
    const off3 = subPrefs();
    return () => {
      cancelled = true;
      off1();
      off2();
      off3();
    };
  }, [hydrateAuth, hydrateSpace, hydratePrefs, hydrateChannel, subAuth, subSpace, subPrefs]);

  // 同步 apiUrl
  useEffect(() => {
    setApiUrl(apiUrl?.trim() || DEFAULT_API_URL);
  }, [apiUrl]);

  // 启动 IM 长连接 —— 必须在 hydrate 完成后（要 auth.token），且 sidepanel 卸载时 stop
  useEffect(() => {
    if (!ready) return;
    setupIm();
    if (selectIsLogined(useAuthStore.getState())) {
      startIm();
    }
    // sidepanel SDK 收到的消息 forward 给 background，让通知 / badge 能继续工作
    const off = onImMessage((m) => {
      void sendMessage("imMessageReceived", { message: toMessageView(m) }).catch(() => {});
    });
    return () => {
      off();
      stopIm();
    };
  }, [ready]);

  if (!ready) return null;
  return <>{children}</>;
}
