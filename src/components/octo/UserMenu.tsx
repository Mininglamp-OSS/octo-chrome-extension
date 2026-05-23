import { LogOut, Monitor, Moon, MoreVertical, Settings, Sun } from "lucide-react";
import { getApiUrl } from "@/api/client";
import { useLogout } from "@/api/queries/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChannelType } from "@/const/channel";
import { selectName, useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import { useSpaceStore } from "@/stores/space";
import { channelAvatarUrl, getFirstChar } from "@/utils/avatar";

export function UserMenu() {
  const name = useAuthStore(selectName);
  const myUid = useAuthStore((s) => s.state?.uid ?? "");
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const logout = useLogout();
  const avatarUrl = myUid ? channelAvatarUrl(getApiUrl(), myUid, ChannelType.person, spaceId) : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <Avatar className="h-7 w-7">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name ?? "me"} />}
            <AvatarFallback className="text-xs">{getFirstChar(name ?? "?")}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="truncate">{name ?? "未命名"}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs text-(--color-muted-foreground)">
          主题
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => void setTheme(v as "light" | "dark" | "system")}
        >
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 h-3.5 w-3.5" /> 浅色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 h-3.5 w-3.5" /> 深色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="mr-2 h-3.5 w-3.5" /> 跟随系统
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => browser.runtime.openOptionsPage()}>
          <Settings /> 设置
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void logout.mutateAsync()}
          className="text-(--color-destructive)"
        >
          <LogOut /> 退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MoreMenu() {
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <MoreVertical className="h-4 w-4" />
    </Button>
  );
}
