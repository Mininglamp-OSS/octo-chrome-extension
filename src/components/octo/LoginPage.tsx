import { ShieldCheck, TriangleAlert } from "lucide-react";
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

/** 柔光背景：白底 + 左上紫 / 右下蓝，两层超淡 radial */
const SOFT_BG_STYLE: React.CSSProperties = {
  backgroundImage: [
    "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(139,92,246,0.12) 0%, transparent 55%)",
    "radial-gradient(ellipse 80% 50% at 100% 100%, rgba(56,189,248,0.14) 0%, transparent 55%)",
  ].join(", "),
};

export function LoginPage() {
  const appConfig = useAppConfig();
  const providers = appConfig.data?.oidc_providers ?? [];
  const primary = providers[0];

  async function onClickProvider(p: OidcProvider) {
    try {
      const authcode = await fetchAuthcode();
      const url = buildAuthorizeUrl({
        authorizePath: p.authorize_path,
        authcode,
        returnTo: `${getWebOrigin()}/login`,
      });
      const host = await browser.windows.getCurrent();
      // 多显示器虚拟桌面坐标可能是负数，不要 clamp 到 >= 0，否则 popup 会被强行拽回主屏
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
        await sendMessage("startSsoPolling", { authcode, windowId: created.id });
      }
    } catch (err) {
      toast.error(extractErrorMsg(err) || "无法打开登录窗口");
    }
  }

  return (
    <main className="flex h-full flex-col bg-white px-6 py-10" style={SOFT_BG_STYLE}>
      {/* 顶部：真实 logo + Octo + 插件版徽章 */}
      <div className="flex animate-[fade-up_0.55s_cubic-bezier(0.2,0.8,0.2,1)_both] items-center gap-3">
        <img
          src="/icon/128.png"
          alt="Octo"
          className="h-11 w-11 [filter:drop-shadow(0_6px_14px_rgba(99,102,241,0.45))]"
          draggable={false}
        />
        <span className="text-lg font-extrabold tracking-tight text-slate-900">Octo</span>
        <span
          className="ml-auto rounded-full border border-indigo-500/15 bg-indigo-500/8 px-2 py-0.5 text-[10px] font-medium tracking-wide text-indigo-700"
          style={{ background: "rgba(99,102,241,0.08)" }}
        >
          插件版
        </span>
      </div>

      {/* 中部内容 */}
      <div className="mt-20 flex-1">
        <h1
          className="animate-[fade-up_0.55s_cubic-bezier(0.2,0.8,0.2,1)_both] text-3xl font-extrabold leading-tight tracking-tight text-slate-900"
          style={{ animationDelay: "0.1s" }}
        >
          欢迎来到
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)",
            }}
          >
            Octo
          </span>
        </h1>
        <p
          className="mt-3 animate-[fade-up_0.55s_cubic-bezier(0.2,0.8,0.2,1)_both] text-[13.5px] leading-relaxed text-slate-500"
          style={{ animationDelay: "0.2s" }}
        >
          AI Agent 时代的即时通讯平台
          <br />
          浏览器右侧随开随用，对话不打断当前页面
        </p>

        <div
          className="mt-8 animate-[fade-up_0.55s_cubic-bezier(0.2,0.8,0.2,1)_both]"
          style={{ animationDelay: "0.3s" }}
        >
          <ProviderArea
            isPending={appConfig.isPending}
            isError={appConfig.isError}
            error={appConfig.error}
            primary={primary}
            extras={providers.slice(1)}
            onRetry={() => appConfig.refetch()}
            onPick={onClickProvider}
          />
        </div>
      </div>
    </main>
  );
}

function ProviderArea({
  isPending,
  isError,
  error,
  primary,
  extras,
  onRetry,
  onPick,
}: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  primary: OidcProvider | undefined;
  extras: OidcProvider[];
  onRetry: () => void;
  onPick: (p: OidcProvider) => void;
}) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-3 w-44 animate-pulse self-center rounded bg-slate-100" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
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
  if (!primary) {
    return (
      <p className="text-center text-sm text-slate-500">未配置 SSO Provider，请联系管理员</p>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => onPick(primary)}
        className="octo-btn-sso inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white will-change-transform"
      >
        <ShieldCheck className="h-[18px] w-[18px]" />
        使用 {primary.name} 登录
      </button>
      <p className="mt-3 text-center text-[11.5px] leading-relaxed text-slate-400">
        新用户首次点击将自动创建 {primary.name} 账号
      </p>
      {extras.length > 0 && (
        <div className="mt-5 flex flex-col gap-2">
          {extras.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              使用 {p.name} 登录
            </button>
          ))}
        </div>
      )}
    </>
  );
}
