import { LogIn } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLogin } from "@/api/queries/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("请填写账号和密码");
      return;
    }
    try {
      await login.mutateAsync({ username: username.trim(), password });
    } catch (err) {
      toast.error(extractErrorMsg(err) || "登录失败");
    }
  }

  return (
    <main className="flex h-full flex-col items-center justify-center bg-(--color-background) p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-2 pb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--color-primary) text-(--color-primary-foreground)">
          <LogIn className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">登录 Octo</h1>
        <p className="text-xs text-(--color-muted-foreground)">使用账号密码登录</p>
      </div>

      <form className="flex w-full max-w-xs flex-col gap-3" onSubmit={onSubmit}>
        <Input
          type="text"
          placeholder="账号 / 手机号"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />
        <Input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <Button type="submit" disabled={login.isPending} className="mt-2">
          {login.isPending ? "登录中…" : "登录"}
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-(--color-muted-foreground)">
        登录即表示同意继续连接 dmwork 后端
      </p>
    </main>
  );
}
