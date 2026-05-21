import { browser } from "wxt/browser";
import { onMessage } from "@/platform/messaging";
import { type AuthState, authStorage } from "@/platform/storage";
import { type PollHandle, pollAuthStatus, type PollResult } from "./oidc";

interface SsoSession {
  windowId: number;
  pollHandle: PollHandle;
}

let session: SsoSession | null = null;

export function setupSso(): void {
  // 用户手动关闭弹窗 → 取消轮询并清状态
  browser.windows.onRemoved.addListener((winId) => {
    if (session?.windowId === winId) {
      session.pollHandle.cancel();
      session = null;
    }
  });

  onMessage("startSsoPolling", async ({ data }) => {
    startPolling(data.authcode, data.windowId);
  });
}

/**
 * sidepanel 已经创建好 popup（在 sidepanel 上下文 create 才能保证
 * monitor 跟随 sidepanel host window）。这里只负责轮询 + 关窗。
 */
function startPolling(authcode: string, windowId: number): void {
  // 替换前一个 session（防 sidepanel 被双触发）
  if (session) session.pollHandle.cancel();

  const { promise, handle } = pollAuthStatus(authcode);
  session = { windowId, pollHandle: handle };

  void promise.then(async (res) => {
    const current = session;
    if (current?.windowId !== windowId) return;
    session = null;

    if (res.ok && res.result) {
      await applyAuthResult(res.result);
    }
    try {
      await browser.windows.remove(windowId);
    } catch {
      // 已被用户/系统关闭
    }
  });
}

async function applyAuthResult(r: NonNullable<PollResult["result"]>): Promise<void> {
  const auth: AuthState = {
    token: r.token,
    uid: r.uid,
    ...(r.name != null && { name: r.name }),
    ...(r.short_no != null && { shortNo: r.short_no }),
    ...(r.sex != null && { sex: r.sex }),
    ...(r.role != null && { role: r.role }),
    loggedIn: true,
    loggedInAt: Date.now(),
  };
  await authStorage.setValue(auth);
  // setupAuthSync 会监听 storage 自动广播 authChanged，sidepanel 自动切到主界面
}
