import { browser } from "wxt/browser";

/**
 * Offscreen document 生命周期管理。
 *
 * - 仅在 auth 就绪后创建（节省未登录用户的资源）
 * - reason 用 WORKERS（一直运行 SDK + 心跳）；不用 AUDIO_PLAYBACK，因为 octo 不放声音
 * - chrome.offscreen.createDocument 同 url 重复调用会抛 "Only a single offscreen document"，
 *   用 hasDocument() 守卫
 */

const OFFSCREEN_PATH = "offscreen.html";
const REASONS: chrome.offscreen.Reason[] = [chrome.offscreen.Reason.WORKERS];
const JUSTIFICATION =
  "Maintain IM long connection so unread badge and notifications work when sidepanel is closed";

let creating: Promise<void> | null = null;

async function hasDocument(): Promise<boolean> {
  const off = (chrome as unknown as { offscreen?: { hasDocument?: () => Promise<boolean> } })
    .offscreen;
  if (off?.hasDocument) {
    return await off.hasDocument();
  }
  // 兜底：旧 chrome 没有 hasDocument，用 getContexts 枚举
  const getContexts = (
    chrome.runtime as unknown as {
      getContexts?: (filter: { contextTypes: string[] }) => Promise<unknown[]>;
    }
  ).getContexts;
  if (getContexts) {
    const ctx = await getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
    return ctx.length > 0;
  }
  return false;
}

export async function ensureOffscreenDocument(): Promise<void> {
  if (creating) return creating;
  if (await hasDocument()) return;

  creating = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: REASONS,
        justification: JUSTIFICATION,
      });
      console.info("[octo:bg] offscreen document created");
    } catch (err) {
      // 并发竞态：另一路已经创建好了，吞掉
      const msg = (err as Error).message ?? "";
      if (!/Only a single offscreen/i.test(msg)) {
        console.warn("[octo:bg] createOffscreenDocument failed", err);
      }
    } finally {
      creating = null;
    }
  })();
  return creating;
}

export async function closeOffscreenDocument(): Promise<void> {
  if (!(await hasDocument())) return;
  try {
    await chrome.offscreen.closeDocument();
    console.info("[octo:bg] offscreen document closed");
  } catch (err) {
    console.warn("[octo:bg] closeOffscreenDocument failed", err);
  }
}

/** 装配：auth-sync 之外的钩子，确保扩展首次加载若已登录，立即拉起 offscreen */
export function setupOffscreen(): void {
  // service worker 重启时立刻尝试，authStorage 已有值则建 offscreen
  void (async () => {
    const { authStorage } = await import("@/platform/storage");
    const auth = await authStorage.getValue();
    if (auth?.loggedIn) {
      await ensureOffscreenDocument();
    }
  })();

  // 浏览器启动也尝试一次（auth 还在 storage 里就直接拉起）
  browser.runtime.onStartup.addListener(() => {
    void (async () => {
      const { authStorage } = await import("@/platform/storage");
      const auth = await authStorage.getValue();
      if (auth?.loggedIn) {
        await ensureOffscreenDocument();
      }
    })();
  });
}
