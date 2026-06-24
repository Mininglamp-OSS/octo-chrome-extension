import { browser } from "wxt/browser";
import { shouldGrantClaim } from "@/im/slot";
import { onMessage, sendMessage } from "@/platform/messaging";
import { openSidePanel } from "@/platform/sidePanel";
import { imSlotClaimStorage, pendingConversationStorage } from "@/platform/storage";
import { closeOffscreenDocument } from "./offscreen";

export function setupHandlers(): void {
  // 用户点工具栏图标 → 打开 sidepanel
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.windowId != null) await openSidePanel(tab.windowId);
  });

  // 请求打开 sidepanel —— 必须同步从 sender.tab 拿 windowId 后立刻 fire sp.open()，
  // 任何 await 在前都会丢失 user gesture（如 await browser.windows.getCurrent()），
  // 表现为「点按钮没反应」。与 requestOpenConversation 同款保手势模式。
  onMessage("requestOpenSidePanel", ({ data, sender }) => {
    const windowId =
      data?.windowId ??
      (sender as { tab?: { windowId?: number } } | undefined)?.tab?.windowId;
    void openSidePanel(windowId).catch(() => {});
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

  onMessage("claimImSlot", async ({ data }) => {
    // 单 owner 仲裁：已有他人的 active claim 时拒绝，防止两个 cmdk 实例（多 tab）
    // 都抢到槽位、都连 deviceFlag=2 互踢。无 claim / 已过期 / 同 id 续期 → 放行。
    const current = await imSlotClaimStorage.getValue();
    if (!shouldGrantClaim(current, data.claim)) return false;
    await imSlotClaimStorage.setValue(data.claim);
    await closeOffscreenDocument();
    return true;
  });

  onMessage("releaseImSlot", async ({ data }) => {
    const current = await imSlotClaimStorage.getValue();
    if (current?.id !== data.id) return;
    await imSlotClaimStorage.setValue(null);
  });
}
