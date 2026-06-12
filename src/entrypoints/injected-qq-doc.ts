/**
 * 腾讯文档 / 企业微信文档 main-world 注入脚本
 *
 * 职责：
 * - 监听文档内文字选区变化
 * - 把当前选区文本 + 文档标题 + 文档 URL 通过 window.postMessage 抛给 content script
 *
 * 实现：腾讯文档自身 iframe 嵌套较深，不能直接靠 content script 的 selection 拿到，
 * 需要 main world 注入后用 window 访问页面里 React 实例 / 实时 selection。这里实现
 * 最稳的"原生 selection"路径，足够 90% 场景。复杂的"协作选区/批注/单元格"读取保留给后续。
 */
export default defineUnlistedScript(() => {
  const SOURCE = "octo-qq-doc";

  function bridgeSelection(): void {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!text) return;
    window.postMessage(
      {
        source: SOURCE,
        cmd: "selectionChanged",
        text,
        pageTitle: document.title,
        pageUrl: location.href,
      },
      window.location.origin,
    );
  }

  document.addEventListener("mouseup", bridgeSelection);
  document.addEventListener("keyup", (e) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) bridgeSelection();
  });

  // 暴露 API 让宿主页可主动触发
  Object.defineProperty(window, "octoQQDoc", {
    value: { snapshot: bridgeSelection },
    writable: false,
    enumerable: false,
  });
});
