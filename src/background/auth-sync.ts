import { onMessage, sendMessage } from "@/platform/messaging";
import { authStorage } from "@/platform/storage";
import { setUnreadBadge } from "./badge";
import { closeOffscreenDocument, ensureOffscreenDocument } from "./offscreen";

/**
 * Auth 跨 context 同步：
 * - 任意 context 写 wxt/storage 都会触发 watch，由 background 转发广播
 * - sidepanel/cmdk/offscreen 用 useAuthStore.subscribe 监听 wxt/storage 自动同步
 * - background 还负责：登录后拉起 offscreen 进程；登出后关闭 offscreen + 清红点
 */
export function setupAuthSync(): void {
  authStorage.watch((next) => {
    if (next?.loggedIn) {
      void ensureOffscreenDocument();
      void sendMessage("authChanged", { auth: next }).catch(() => {});
    } else {
      void closeOffscreenDocument();
      void setUnreadBadge(false);
      void sendMessage("authCleared", undefined).catch(() => {});
    }
  });

  // 接收来自 401 拦截器的清除指令
  onMessage("authCleared", async () => {
    await authStorage.setValue(null);
  });
}
