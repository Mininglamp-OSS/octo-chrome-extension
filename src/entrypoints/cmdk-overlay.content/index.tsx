import { createRoot } from "react-dom/client";
import "../../styles/globals.css";
import { CmdKOverlay } from "./CmdKOverlay";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  runAt: "document_idle",
  async main(ctx) {
    // 把 window.pluginCall 注到 main world
    const script = document.createElement("script");
    script.src = browser.runtime.getURL("/injected-plugin-call.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    const ui = await createShadowRootUi(ctx, {
      name: "octo-cmdk-root",
      position: "overlay",
      zIndex: 2147483647,
      isolateEvents: true,
      onMount(container) {
        const root = createRoot(container);
        root.render(<CmdKOverlay />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
