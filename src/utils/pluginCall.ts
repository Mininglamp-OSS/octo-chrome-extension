/**
 * window.pluginCall payload 校验 / 规范化。
 * 抽成纯函数以便 unit test，并在 injected-plugin-call.ts main world 脚本里复用。
 *
 * 与 mirror (apps/extension/utils/pluginCall.ts) 完全对齐。
 */

export type PluginCallSub = "sendMessage";

export interface PluginCallMessage {
  type: "OCTO_PLUGIN_CALL";
  sub: PluginCallSub;
  value: string;
}

export type NormalizeResult =
  | { ok: true; message: PluginCallMessage }
  | { ok: false; reason: string };

export function normalizePluginCall(payload: unknown): NormalizeResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "payload must be an object" };
  }
  const p = payload as { type?: unknown; value?: unknown };

  if (p.type !== "sendMessage") {
    return {
      ok: false,
      reason: `unsupported type: ${String(p.type)} (only "sendMessage" is supported)`,
    };
  }
  if (typeof p.value !== "string") {
    return {
      ok: false,
      reason: `value must be a string, got ${typeof p.value}`,
    };
  }
  if (p.value.trim() === "") {
    return { ok: false, reason: "value is empty" };
  }

  return {
    ok: true,
    message: { type: "OCTO_PLUGIN_CALL", sub: "sendMessage", value: p.value },
  };
}
