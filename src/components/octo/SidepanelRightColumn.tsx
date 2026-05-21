import { LogOut, Plus, Users } from "lucide-react";
import { useState } from "react";
import { useLogout } from "@/api/queries/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDrawerStore } from "@/stores/drawer";
import { useCategoriesUi } from "@/stores/categoriesUi";
import { cn } from "@/utils/cn";
import { VerticalRail } from "./VerticalRail";

interface Props {
  onShowPicker?: () => void;
}

/**
 * 右侧列 = 顶部 VerticalRail（pinned 频道头像）+ 底部 3 个图标（contacts / + / logout）
 * 对齐 mirror 右侧布局：rail 在上、footer icons 在下。
 */
export function SidepanelRightColumn({ onShowPicker }: Props) {
  const openContacts = useDrawerStore((s) => s.openContacts);
  const openManage = useCategoriesUi((s) => s.openManage);
  const logout = useLogout();
  // 二次确认登出：第一次进入 armed 态（红色），5 秒内再点才真退
  const [armed, setArmed] = useState(false);

  function onLogoutClick(): void {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 5000);
      return;
    }
    void logout.mutateAsync();
  }

  return (
    <aside className="flex w-12 shrink-0 flex-col border-l">
      {/* 顶部 rail */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <VerticalRail onShowPicker={onShowPicker} />
      </div>

      {/* 底部三图标 */}
      <div className="flex shrink-0 flex-col items-center gap-1 border-t py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="通讯录"
          onClick={openContacts}
        >
          <Users className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="新建">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="left" className="w-36">
            <DropdownMenuItem disabled>发起私聊</DropdownMenuItem>
            <DropdownMenuItem disabled>创建群聊</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openManage()}>创建分组</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-(--color-destructive)",
            armed && "bg-(--color-destructive)/15",
          )}
          title={armed ? "再点一次确认退出" : "退出登录"}
          onClick={onLogoutClick}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
