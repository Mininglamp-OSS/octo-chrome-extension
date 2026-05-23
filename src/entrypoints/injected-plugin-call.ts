/**
 * 注入到网页 main world 的脚本，定义 window.pluginCall。
 * 网页代码这样调：
 *   window.pluginCall({ type: 'sendMessage', value: '要在划词弹窗里发送的文本' });
 *
 * 转发为 window.postMessage（限定同源），由 cmdk-overlay 的 isolated world
 * content script 监听，触发 cmdk 划词弹窗。
 *
 * 设计目标（对齐 mirror apps/extension/entrypoints/injected-plugin-call.ts）：
 * - type 字段为未来扩展预留，目前只识别 'sendMessage'
 * - value 必须非空 string
 * - 校验失败 console.warn 提示接入方，避免静默踩坑
 * - 防重复注入：BOOT_FLAG 保护，多次执行不破坏现有引用
 */

import { normalizePluginCall } from "@/utils/pluginCall";

const BOOT_FLAG = "__OCTO_PLUGIN_CALL_BOOTED__";

export default defineUnlistedScript(() => {
  const w = window as unknown as Record<string, unknown>;
  if (w[BOOT_FLAG]) return;
  w[BOOT_FLAG] = true;

  w.pluginCall = (payload: unknown) => {
    const result = normalizePluginCall(payload);
    if (!result.ok) {
      console.warn("[Octo] pluginCall ignored:", result.reason, payload);
      return;
    }
    window.postMessage(result.message, window.location.origin);
  };
});
