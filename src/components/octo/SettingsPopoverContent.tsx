import { usePreferencesStore } from "@/stores/preferences";
import { cn } from "@/utils/cn";

/**
 * 设置 Popover 内容：阅读模式 (消息版/简化版) + 主题 (Paper/Moon)
 * 1:1 移植自 mirror OctoSidepanelLayout.tsx 内联的 `octo-settings-pop`，但用 Tailwind 重写。
 *
 * 用作 shadcn <PopoverContent> 的 children。
 */

type Layout = "message" | "cli";

const LAYOUT_OPTIONS: Array<{ id: Layout; label: string }> = [
  { id: "message", label: "消息版" },
  { id: "cli", label: "简化版" },
];

interface ThemeOption {
  id: "paper" | "moon";
  label: string;
  /** mirror setTheme(isDark) */
  isDark: boolean;
}
const THEME_OPTIONS: ThemeOption[] = [
  { id: "paper", label: "Paper", isDark: false },
  { id: "moon", label: "Moon", isDark: true },
];

export function SettingsPopoverContent() {
  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const layout = usePreferencesStore((s) => s.prefs.layout);
  const notificationsEnabled = usePreferencesStore((s) => s.prefs.notificationsEnabled);
  const notificationsVisible = usePreferencesStore((s) => s.prefs.notificationsVisible);
  const setPrefs = usePreferencesStore((s) => s.setPrefs);

  // theme: light → paper, dark → moon, system → 用浏览器实际偏好估算
  const activeThemeId: "paper" | "moon" =
    theme === "dark"
      ? "moon"
      : theme === "light"
        ? "paper"
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "moon"
          : "paper";

  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      {/* 阅读模式 */}
      <SectionHeader>阅读模式</SectionHeader>
      <Segment>
        {LAYOUT_OPTIONS.map((opt) => (
          <SegmentButton
            key={opt.id}
            active={layout === opt.id}
            onClick={() => void setPrefs({ layout: opt.id })}
          >
            {opt.label}
          </SegmentButton>
        ))}
      </Segment>

      {/* 主题 */}
      <SectionHeader>主题</SectionHeader>
      <Segment>
        {THEME_OPTIONS.map((opt) => (
          <SegmentButton
            key={opt.id}
            active={activeThemeId === opt.id}
            onClick={() => void setTheme(opt.isDark ? "dark" : "light")}
          >
            <ThemeDot kind={opt.id} />
            <span>{opt.label}</span>
          </SegmentButton>
        ))}
      </Segment>

      {/* 未读角标提醒 */}
      <SectionHeader>未读角标提醒</SectionHeader>
      <Segment>
        <SegmentButton
          active={notificationsEnabled}
          onClick={() => void setPrefs({ notificationsEnabled: true })}
        >
          开启
        </SegmentButton>
        <SegmentButton
          active={!notificationsEnabled}
          onClick={() => void setPrefs({ notificationsEnabled: false, notificationsVisible: false })}
        >
          关闭
        </SegmentButton>
      </Segment>

      {/* 桌面弹窗通知 */}
      <SectionHeader>桌面弹窗通知</SectionHeader>
      <Segment>
        <SegmentButton
          active={notificationsVisible}
          disabled={!notificationsEnabled}
          onClick={() => void setPrefs({ notificationsVisible: true })}
        >
          开启
        </SegmentButton>
        <SegmentButton
          active={!notificationsVisible}
          disabled={!notificationsEnabled}
          onClick={() => void setPrefs({ notificationsVisible: false })}
        >
          关闭
        </SegmentButton>
      </Segment>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-1 pb-0.5 text-[10.5px] font-medium uppercase tracking-wider text-(--color-muted-foreground)">
      {children}
    </div>
  );
}

function Segment({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-1 mb-1 flex gap-0.5 rounded-[7px] bg-(--color-muted)/60 p-[3px]">
      {children}
    </div>
  );
}

function SegmentButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 py-1 text-[11.5px] font-medium transition-colors",
        active
          ? "bg-(--color-background) text-(--color-foreground) shadow-sm"
          : "text-(--color-muted-foreground) hover:text-(--color-foreground)",
        disabled && "cursor-not-allowed opacity-50 hover:text-(--color-muted-foreground)",
      )}
    >
      {children}
    </button>
  );
}

function ThemeDot({ kind }: { kind: "paper" | "moon" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        kind === "paper" ? "bg-amber-100 ring-1 ring-amber-300" : "bg-slate-700",
      )}
    />
  );
}
