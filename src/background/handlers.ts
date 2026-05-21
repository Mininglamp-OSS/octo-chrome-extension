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

  // 请求跳转某个会话 —— 先记到 pending，sidepanel 起来后读
  onMessage("requestOpenConversation", async ({ data }) => {
    await pendingConversationStorage.setValue(data);
    await openSidePanel();
    // 给 sidepanel 一点时间挂载再广播
    setTimeout(() => {
      void sendMessage("openConversation", data).catch(() => {});
    }, 200);
  });

  // sidepanel 主动请求当前 auth（开机自检）
  onMessage("getAuthState", async () => {
    const value = await (await import("@/platform/storage")).authStorage.getValue();
    return { auth: value };
  });
}
