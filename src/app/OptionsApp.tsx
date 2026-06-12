import { LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DEFAULT_API_URL } from "@/api/endpoints";
import { useLogout } from "@/api/queries/auth";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { selectIsLogined, useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import { validateApiUrl } from "@/utils/apiUrlGuard";
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
  // 白名单外的 https 地址需二次确认才保存；暂存待确认的地址。
  const [untrustedUrl, setUntrustedUrl] = useState<string | null>(null);
  const logout = useLogout();

  async function persistApiUrl(value: string): Promise<void> {
    await setPrefs({ apiUrl: value });
    toast.success("API 地址已保存，下次连接时生效");
  }

  async function saveApiUrl(): Promise<void> {
    const trimmed = apiUrlDraft.trim();
    // 留空 = 使用默认地址，直接保存。
    if (!trimmed) {
      await persistApiUrl("");
      return;
    }
    const result = validateApiUrl(trimmed);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    if (!result.trusted) {
      // 白名单外地址：弹二次确认，确认后才落库。
      setUntrustedUrl(trimmed);
      return;
    }
    await persistApiUrl(trimmed);
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
        <p className="mt-1 text-xs text-(--color-muted-foreground)">默认：{DEFAULT_API_URL}</p>
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

      <Section title="通知" desc="未读时在工具栏图标右上点亮红点；可选额外弹出系统桌面通知">
        <ToggleRow
          label="未读角标"
          on={prefs.notificationsEnabled}
          onChange={(v) => void setPrefs({ notificationsEnabled: v })}
        />
        <ToggleRow
          label="桌面通知"
          desc="收到新消息时在系统通知中心弹出"
          on={prefs.notificationsVisible}
          disabled={!prefs.notificationsEnabled}
          onChange={(v) => void setPrefs({ notificationsVisible: v })}
        />
      </Section>

      <Separator />

      {isLogined && (
        <Section title="账号">
          <Button variant="destructive" size="sm" onClick={() => setLogoutOpen(true)}>
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

      <ConfirmDialog
        open={untrustedUrl !== null}
        onOpenChange={(o) => {
          if (!o) setUntrustedUrl(null);
        }}
        title="确认使用非可信服务器？"
        description="该地址不在可信列表中，登录凭证将被发送到此服务器。请确认你信任该地址再继续。"
        confirmText="仍然保存"
        variant="destructive"
        onConfirm={async () => {
          if (untrustedUrl !== null) await persistApiUrl(untrustedUrl);
          setUntrustedUrl(null);
        }}
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

function ToggleRow({
  label,
  desc,
  on,
  disabled,
  onChange,
}: {
  label: string;
  desc?: string;
  on: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className={`text-sm ${disabled ? "text-(--color-muted-foreground)" : ""}`}>
          {label}
        </span>
        {desc && <span className="text-xs text-(--color-muted-foreground)">{desc}</span>}
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={on ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onChange(true)}
        >
          开
        </Button>
        <Button
          size="sm"
          variant={!on ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onChange(false)}
        >
          关
        </Button>
      </div>
    </div>
  );
}
