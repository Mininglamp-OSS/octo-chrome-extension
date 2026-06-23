import { useEffect, useRef, useState } from "react";
import { setApiUrl } from "@/api/client";
import { DEFAULT_API_URL } from "@/api/endpoints";
import { useApplyTheme } from "@/hooks/useApplyTheme";
import { setupIm, startIm, stopIm } from "@/im/client";
import {
  CMDK_IM_SLOT_REFRESH_MS,
  createCmdkImSlotClaim,
  isActiveImSlotClaim,
} from "@/im/slot";
import { registerAllRenders } from "@/messages/renders";
import { sendMessage } from "@/platform/messaging";
import { imSlotClaimStorage } from "@/platform/storage";
import { selectIsLogined, useAuthStore } from "@/stores/auth";
import { useCurrentChannel } from "@/stores/currentChannel";
import { usePreferencesStore } from "@/stores/preferences";
import { useSpaceStore } from "@/stores/space";
import { hydrateAvatarTags, subscribeAvatarTags } from "@/utils/avatar";

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
export function AppBoot({
  children,
  claimImSlot = false,
  enableIm = true,
}: {
  children: React.ReactNode;
  claimImSlot?: boolean;
  enableIm?: boolean;
}) {
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
  const [imSlotReady, setImSlotReady] = useState(!claimImSlot);
  const [blockedByImSlot, setBlockedByImSlot] = useState(false);
  const imSlotClaimIdRef = useRef<string | null>(null);
  const imSlotMountedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      hydrateAuth(),
      hydrateSpace(),
      hydratePrefs(),
      hydrateChannel(),
      hydrateAvatarTags(),
    ])
      .catch(() => {
        // hydrate 内部各自有 fallback
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    const off1 = subAuth();
    const off2 = subSpace();
    const off3 = subPrefs();
    const off4 = subscribeAvatarTags();
    return () => {
      cancelled = true;
      off1();
      off2();
      off3();
      off4();
    };
  }, [hydrateAuth, hydrateSpace, hydratePrefs, hydrateChannel, subAuth, subSpace, subPrefs]);

  // 同步 apiUrl
  useEffect(() => {
    setApiUrl(apiUrl?.trim() || DEFAULT_API_URL);
  }, [apiUrl]);

  useEffect(() => {
    if (!claimImSlot) return;
    const id = imSlotClaimIdRef.current ?? crypto.randomUUID();
    imSlotClaimIdRef.current = id;
    imSlotMountedRef.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const claim = async () => {
      const value = createCmdkImSlotClaim(id);
      try {
        await sendMessage("claimImSlot", { claim: value });
      } catch {
        await imSlotClaimStorage.setValue(value);
      }
      if (!cancelled) setImSlotReady(true);
    };
    void claim();
    timer = setInterval(() => void claim(), CMDK_IM_SLOT_REFRESH_MS);
    return () => {
      cancelled = true;
      imSlotMountedRef.current = false;
      if (timer) clearInterval(timer);
      setTimeout(() => {
        if (imSlotMountedRef.current) return;
        void sendMessage("releaseImSlot", { id }).catch(() => {
          void imSlotClaimStorage.getValue().then((current) => {
            if (current?.id === id) void imSlotClaimStorage.setValue(null);
          });
        });
      }, 500);
    };
  }, [claimImSlot]);

  useEffect(() => {
    if (!enableIm) return;
    if (claimImSlot) return;
    let cancelled = false;
    // 本地 TTL 自愈：claim 是 active 时排一个定时器到它 expiresAt 那一刻重跑 apply。
    // 否则 cmdk 非正常退出残留 claim 后，storage 不再变化、watch 不再触发，本进程
    // 会一直 blockedByImSlot=true 把 IM stop 住——光靠 background alarm 清理有延迟
    // 且依赖 SW 被唤醒；前台自己排一刀让 sidepanel 在 claim 过期瞬间立即恢复连接。
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    const apply = (claim: Awaited<ReturnType<typeof imSlotClaimStorage.getValue>>) => {
      if (cancelled) return;
      if (expiryTimer) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
      }
      const blocked = isActiveImSlotClaim(claim);
      setBlockedByImSlot(blocked);
      if (blocked) {
        stopIm();
        const ms = Math.max(0, (claim as { expiresAt: number }).expiresAt - Date.now());
        expiryTimer = setTimeout(() => apply(claim), ms + 50);
      }
    };
    void imSlotClaimStorage.getValue().then(apply);
    const unwatch = imSlotClaimStorage.watch(apply);
    return () => {
      cancelled = true;
      if (expiryTimer) clearTimeout(expiryTimer);
      unwatch();
    };
  }, [claimImSlot, enableIm]);

  // 启动 IM 长连接 —— 必须在 hydrate 完成后（要 auth.token），且卸载时 stop。
  //
  // 不能只在 ready 翻转那一刻判断一次登录态：cmdk 是用户触发时才挂载的独立 iframe，
  // 它的 hydrate 完成（ready=true）可能早于 auth storage 同步出登录态，导致 startIm
  // 被 selectIsLogined 跳过后再也不重试 —— 表现为 sdk.config.uid/token 为空、
  // connectManager 一直 Disconnect、发消息报「IM 未连接」。
  //
  // 改为：ready 后先尝一次，并订阅 auth 变化，登录态从无到有时补连（startIm 内部
  // connectStarted 幂等，重复调用安全）。
  useEffect(() => {
    if (!enableIm) return;
    if (!ready || !imSlotReady || blockedByImSlot) return;
    setupIm();
    const tryStart = () => {
      if (selectIsLogined(useAuthStore.getState())) startIm();
    };
    tryStart();
    const unsub = useAuthStore.subscribe(tryStart);
    return () => {
      unsub();
      stopIm();
    };
  }, [ready, enableIm, imSlotReady, blockedByImSlot]);

  if (!ready || !imSlotReady) return null;
  return <>{children}</>;
}
