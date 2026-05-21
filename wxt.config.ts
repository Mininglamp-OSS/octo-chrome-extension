import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  srcDir: "src",
  outDir: ".output",
  webExt: { disabled: true },
  autoIcons: { developmentIndicator: false },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  }),
  manifest: {
    name: "Octo 插件版",
    description: "",
    side_panel: { default_path: "sidepanel.html" },
    options_ui: { page: "options.html", open_in_tab: true },
    permissions: ["notifications", "storage", "sidePanel", "contextMenus", "scripting"],
    autoIcons: {
      developmentIndicator: false,
    },
    host_permissions: ["<all_urls>"],
    web_accessible_resources: [
      {
        resources: ["/injected-qq-doc.js"],
        matches: [
          "https://docs.qq.com/*",
          "https://*.docs.qq.com/*",
          "https://doc.weixin.qq.com/*",
          "https://*.doc.weixin.qq.com/*",
        ],
      },
      {
        resources: ["/injected-plugin-call.js"],
        matches: ["<all_urls>"],
      },
      {
        resources: ["/cmdk.html"],
        matches: ["<all_urls>"],
      },
    ],
    action: {},
  },
});
