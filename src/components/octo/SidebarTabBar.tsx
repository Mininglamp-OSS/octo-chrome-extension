import { cn } from "@/utils/cn";

export type ConversationTab = "group" | "dm";

interface SidebarTabBarProps {
  activeTab: ConversationTab;
  onTabChange: (tab: ConversationTab) => void;
}

const TABS: ReadonlyArray<{ id: ConversationTab; label: string }> = [
  { id: "group", label: "群聊" },
  { id: "dm", label: "私聊" },
];

/**
 * mirror 插件版 .octo-picker-filter-tabs/.octo-picker-filter-tab 等价。
 * 容器：gap 4 / padding 8 12 10；按钮：padding 6 14 / 字号 13 / 圆角 999；
 * 激活态：bg-elevated + foreground + 600。
 */
export function SidebarTabBar({ activeTab, onTabChange }: SidebarTabBarProps) {
  return (
    <div className="flex shrink-0 gap-1 px-3 pt-2 pb-2.5">
      {TABS.map((t) => {
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
              active
                ? "bg-(--color-accent) font-semibold text-(--color-foreground)"
                : "text-(--color-muted-foreground) hover:bg-(--color-accent)/40",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
