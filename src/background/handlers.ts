import { browser } from "wxt/browser";
import { onMessage, sendMessage } from "@/platform/messaging";
import { openSidePanel } from "@/platform/sidePanel";
import { pendingConversationStorage } from "@/platform/storage";

export function setupHandlers(): void {
  // 用户点工具栏图标 → 打开 sidepanel
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.windowId != null) await openSidePanel(tab.windowId);
  });

  // 请求打开 sidepanel
  onMessage("requestOpenSidePanel", async ({ data }) => {
    await openSidePanel(data?.windowId);
  });

  // 请求跳转某个会话 —— 优先用 sender.tab.windowId 同步开 sidePanel（保住 user gesture），
  // 然后异步写 pending + 广播 openConversation（双通道兜底，sidepanel 任选其一消费）。
  // 必须 sync 触发 sp.open()，绝对不能在它前面有任何 await，否则用户手势上下文丢失。
  onMessage("requestOpenConversation", ({ data, sender }) => {
    const windowId = (sender as { tab?: { windowId?: number } } | undefined)?.tab?.windowId;
    void openSidePanel(windowId).catch(() => {});

    void pendingConversationStorage.setValue(data).then(() => {
      setTimeout(() => {
        void sendMessage("openConversation", data).catch(() => {});
      }, 200);
    });
  });

  // sidepanel 主动请求当前 auth（开机自检）
  onMessage("getAuthState", async () => {
    const value = await (await import("@/platform/storage")).authStorage.getValue();
    return { auth: value };
  });
}
