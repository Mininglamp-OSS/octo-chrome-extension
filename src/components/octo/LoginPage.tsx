import { LogIn, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { browser } from "wxt/browser";
import { useAppConfig } from "@/api/queries/appConfig";
import { fetchAuthcode } from "@/api/queries/sso";
import type { OidcProvider } from "@/api/schemas/appConfig";
import { buildAuthorizeUrl, getWebOrigin } from "@/background/oidc";
import { Button } from "@/components/ui/button";
import { sendMessage } from "@/platform/messaging";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

const SSO_POPUP_W = 800;
const SSO_POPUP_H = 600;

export function LoginPage() {
  const appConfig = useAppConfig();
  const providers = appConfig.data?.oidc_providers ?? [];

  async function onClickProvider(p: OidcProvider) {
    try {
      // 必须在 sidepanel 上下文里直接 windows.create —— 这样新窗口的 monitor
      // 跟随 sidepanel 所在 host window，不会飘到其他显示器。
      // 放在 background SW 里 create 反而会让 Chrome 把 left/top 解释到
      // last-focused monitor 的坐标空间，导致跨屏跑偏。
      const authcode = await fetchAuthcode();
      const url = buildAuthorizeUrl({
        authorizePath: p.authorize_path,
        authcode,
        returnTo: `${getWebOrigin()}/login`,
      });
      const host = await browser.windows.getCurrent();
      // 不要 clamp 到 >= 0：多显示器虚拟桌面坐标是有符号的，外接屏在主屏左/上侧
      // 时 left/top 会是负数，clamp 会让 popup 永远跳到主屏。Chrome 接受全局
      // 坐标，自己会路由到正确的 monitor。
      const left =
        host?.left != null && host?.width != null
          ? host.left + Math.round((host.width - SSO_POPUP_W) / 2)
          : undefined;
      const top =
        host?.top != null && host?.height != null
          ? host.top + Math.round((host.height - SSO_POPUP_H) / 2)
          : undefined;
      const created = await browser.windows.create({
        url,
        type: "popup",
        width: SSO_POPUP_W,
        height: SSO_POPUP_H,
        focused: true,
        ...(left != null && { left }),
        ...(top != null && { top }),
      });
      if (created?.id != null) {
        // 让 background 接管轮询 + 关窗：sidepanel 关闭也不影响登录完成
        await sendMessage("startSsoPolling", { authcode, windowId: created.id });
      }
    } catch (err) {
      toast.error(extractErrorMsg(err) || "无法打开登录窗口");
    }
  }

  return (
    <main className="flex h-full flex-col items-center justify-center bg-(--color-background) p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-2 pb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--color-primary) text-(--color-primary-foreground)">
          <LogIn className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">登录 Octo</h1>
        <p className="text-xs text-(--color-muted-foreground)">使用单点登录继续</p>
      </div>

      <Body
        isPending={appConfig.isPending}
        isError={appConfig.isError}
        error={appConfig.error}
        providers={providers}
        onRetry={() => appConfig.refetch()}
        onPick={onClickProvider}
      />

      <p className="mt-8 text-center text-xs text-(--color-muted-foreground)">
        登录即表示同意继续连接 dmwork 后端
      </p>
    </main>
  );
}

function Body({
  isPending,
  isError,
  error,
  providers,
  onRetry,
  onPick,
}: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  providers: OidcProvider[];
  onRetry: () => void;
  onPick: (p: OidcProvider) => void;
}) {
  if (isPending) {
    return (
      <div className="flex w-full max-w-xs flex-col gap-2">
        <div className="h-10 animate-pulse rounded-md bg-(--color-muted)" />
        <div className="h-3 w-32 animate-pulse self-center rounded bg-(--color-muted)" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex w-full max-w-xs flex-col items-center gap-3 text-center">
        <TriangleAlert className="h-5 w-5 text-(--color-destructive)" />
        <p className="text-sm text-(--color-destructive)">
          {extractErrorMsg(error) || "加载登录配置失败"}
        </p>
        <Button type="button" variant="outline" onClick={onRetry}>
          重试
        </Button>
      </div>
    );
  }
  if (providers.length === 0) {
    return (
      <p className="max-w-xs text-center text-sm text-(--color-muted-foreground)">
        未配置 SSO Provider，请联系管理员
      </p>
    );
  }
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      {providers.map((p) => (
        <Button
          key={p.id}
          type="button"
          className="flex w-full items-center justify-center gap-2"
          onClick={() => onPick(p)}
        >
          <ShieldCheck className="h-4 w-4" />
          使用 {p.name} 登录
        </Button>
      ))}
    </div>
  );
}
