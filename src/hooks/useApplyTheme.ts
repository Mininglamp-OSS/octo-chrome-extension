import { useEffect } from "react";
import { usePreferencesStore } from "@/stores/preferences";

/**
 * 把 store 里的 theme 投射到 <html class="dark"|""> 上，并跟随系统变更（system 模式下）。
 * 同时把 prefs.layout（mirror 的 data-layout）写到 html / body 上，供 CSS 切样式。
 */
export function useApplyTheme(): void {
  const theme = usePreferencesStore((s) => s.theme);
  const layout = usePreferencesStore((s) => s.prefs.layout);

  // 主题：light / dark / system
  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: "light" | "dark") => {
      root.classList.toggle("dark", mode === "dark");
    };

    if (theme === "light" || theme === "dark") {
      apply(theme);
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches ? "dark" : "light");
    const onChange = (e: MediaQueryListEvent) => apply(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // 阅读模式 layout —— 与 mirror 一致：data-layout 同时写到 html 和 body
  useEffect(() => {
    document.documentElement.setAttribute("data-layout", layout);
    document.body.setAttribute("data-layout", layout);
  }, [layout]);
}
