import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useLogout } from "@/api/queries/auth";
import { DEFAULT_API_URL } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuthStore, selectIsLogined } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

export function OptionsApp() {
  const isLogined = useAuthStore(selectIsLogined);
  const name = useAuthStore((s) => s.state?.name);
  const uid = useAuthStore((s) => s.state?.uid);

  const prefs = usePreferencesStore((s) => s.prefs);
  const setPrefs = usePreferencesStore((s) => s.setPrefs);
  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);

  const [apiUrlDraft, setApiUrlDraft] = useState(prefs.apiUrl);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const logout = useLogout();

  async function saveApiUrl(): Promise<void> {
    const trimmed = apiUrlDraft.trim();
    if (trimmed && !/^https?:\/\//.test(trimmed)) {
      toast.error("URL 必须以 http(s):// 开头");
      return;
    }
    await setPrefs({ apiUrl: trimmed });
    toast.success("API 地址已保存，下次连接时生效");
  }

  async function doLogout(): Promise<void> {
    try {
      await logout.mutateAsync();
      toast.success("已退出");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "退出失败");
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Octo 设置</h1>
        <p className="mt-1 text-sm text-(--color-muted-foreground)">
          {isLogined ? `当前账号：${name ?? uid}` : "未登录"}
        </p>
      </header>

      <Section title="服务器" desc="留空使用默认地址">
        <div className="flex items-center gap-2">
          <Input
            value={apiUrlDraft}
            onChange={(e) => setApiUrlDraft(e.target.value)}
            placeholder={DEFAULT_API_URL}
            className="flex-1"
          />
          <Button size="sm" onClick={() => void saveApiUrl()}>
            保存
          </Button>
        </div>
        <p className="mt-1 text-xs text-(--color-muted-foreground)">
          默认：{DEFAULT_API_URL}
        </p>
      </Section>

      <Section title="通知" desc="关闭后将不再接收新消息提醒">
        <Toggle
          label="消息通知（角标 + 系统）"
          checked={prefs.notificationsEnabled}
          onChange={(v) => void setPrefs({ notificationsEnabled: v })}
        />
        <Toggle
          label="系统弹窗"
          checked={prefs.notificationsVisible}
          onChange={(v) => void setPrefs({ notificationsVisible: v })}
          disabled={!prefs.notificationsEnabled}
        />
      </Section>

      <Section title="外观">
        <div className="flex items-center gap-2">
          {(["light", "dark", "system"] as const).map((mode) => (
            <Button
              key={mode}
              variant={theme === mode ? "default" : "outline"}
              size="sm"
              onClick={() => void setTheme(mode)}
            >
              {mode === "light" ? "浅色" : mode === "dark" ? "深色" : "跟随系统"}
            </Button>
          ))}
        </div>
      </Section>

      <Separator />

      {isLogined && (
        <Section title="账号">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="mr-1 h-3.5 w-3.5" /> 退出登录
          </Button>
        </Section>
      )}

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="退出登录"
        description="确认要退出当前账号吗？"
        confirmText="退出"
        variant="destructive"
        onConfirm={doLogout}
      />
    </main>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {desc && <p className="text-xs text-(--color-muted-foreground)">{desc}</p>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4"
      />
    </label>
  );
}
