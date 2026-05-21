import { onMessage, sendMessage } from "@/platform/messaging";
import { authStorage } from "@/platform/storage";

/**
 * Auth 跨 context 同步：
 * - 任意 context 写 wxt/storage 都会触发 watch，由 background 转发广播
 * - sidepanel/cmdk/offscreen 用 useAuthStore.subscribe 监听 wxt/storage 自动同步
 *
 * 这里再加一层 messaging 广播是为了：
 * 1. offscreen 没起来时也能尽早被通知（offscreen 启动后 hydrate 即可拿到当前值）
 * 2. 调试可见
 */
export function setupAuthSync(): void {
  authStorage.watch((next) => {
    if (next?.loggedIn) {
      void sendMessage("authChanged", { auth: next }).catch(() => {});
    } else {
      void sendMessage("authCleared", undefined).catch(() => {});
    }
  });

  // 接收来自 401 拦截器的清除指令（如果未来需要）
  onMessage("authCleared", async () => {
    await authStorage.setValue(null);
  });
}
