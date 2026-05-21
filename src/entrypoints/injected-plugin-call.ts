/**
 * Main-world 注入脚本：在任意网页 window 上暴露 octo plugin API
 *
 * 使用：
 *   window.pluginCall?.openCmdK({ text: '想说点啥' });
 *
 * 内部通过 window.postMessage({source: 'octo-plugin-call', cmd, ...}) 与 content
 * script 的 cmdk-overlay 通信。
 */
export default defineUnlistedScript(() => {
  const SOURCE = "octo-plugin-call";

  interface OctoPluginApi {
    openCmdK: (opts?: { text?: string }) => void;
  }

  const api: OctoPluginApi = {
    openCmdK(opts) {
      window.postMessage({ source: SOURCE, cmd: "openCmdK", text: opts?.text ?? "" }, "*");
    },
  };

  Object.defineProperty(window, "pluginCall", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: false,
  });
});
