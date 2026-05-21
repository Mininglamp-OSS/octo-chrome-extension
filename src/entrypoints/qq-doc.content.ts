import { sendMessage } from "@/platform/messaging";

const SOURCE = "octo-qq-doc";

interface QQDocSelectionMsg {
  source: typeof SOURCE;
  cmd: "selectionChanged";
  text: string;
  pageTitle: string;
  pageUrl: string;
}

export default defineContentScript({
  matches: [
    "https://docs.qq.com/*",
    "https://*.docs.qq.com/*",
    "https://doc.weixin.qq.com/*",
    "https://*.doc.weixin.qq.com/*",
  ],
  runAt: "document_idle",
  main() {
    // 注入 main-world 桥接脚本
    const script = document.createElement("script");
    script.src = browser.runtime.getURL("/injected-qq-doc.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    // 监听 main-world 抛出的选区数据，转发给 background / sidepanel
    window.addEventListener("message", (e: MessageEvent) => {
      const data = e.data as QQDocSelectionMsg | null;
      if (!data || data.source !== SOURCE) return;
      if (data.cmd === "selectionChanged") {
        void sendMessage("qqDocSelectionChanged", {
          text: data.text,
          pageTitle: data.pageTitle,
          pageUrl: data.pageUrl,
        }).catch(() => {});
      }
    });

    console.info("[octo:qq-doc] bridge ready");
  },
});
