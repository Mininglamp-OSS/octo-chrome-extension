/**
 * Cmdk 面板里的「点击外部关闭」语义需要避开各种全局弹层（emoji panel / mention 浮窗 /
 * tippy / Radix portal 等），否则用户点弹层外区域会直接关掉 cmdk 面板。
 */
export const PORTAL_SELECTORS: readonly string[] = [
  "[data-tippy-root]",
  ".tippy-box",
  ".tippy-content",
  "[data-radix-popper-content-wrapper]",
  "[data-radix-portal]",
  "[data-floating-ui-portal]",
  "[data-octo-emoji-panel]",
  "[data-octo-mention-popup]",
  "[data-octo-cmdk-portal]",
];

export function isInsidePortal(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return PORTAL_SELECTORS.some((sel) => target.closest(sel) !== null);
}
