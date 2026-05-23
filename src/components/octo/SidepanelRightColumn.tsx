import { LogOut, Users } from "lucide-react";
import { useState } from "react";
import { useLogout } from "@/api/queries/auth";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDrawerStore } from "@/stores/drawer";
import { VerticalRail } from "./VerticalRail";

interface Props {
  onShowPicker?: () => void;
}

/**
 * 右侧列 = 顶部 VerticalRail（pinned 频道头像）+ 底部 2 个图标（contacts / logout）
 * 对齐 mirror 右侧布局：rail 在上、footer icons 在下。
 */
export function SidepanelRightColumn({ onShowPicker }: Props) {
  const openContacts = useDrawerStore((s) => s.openContacts);
  const logout = useLogout();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <aside className="flex w-12 shrink-0 flex-col border-l">
      {/* 顶部 rail */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <VerticalRail onShowPicker={onShowPicker} />
      </div>

      {/* 底部图标 */}
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

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-(--color-destructive)"
          title="退出登录"
          onClick={() => setConfirmOpen(true)}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="退出登录"
        description="确认要退出当前账号吗？"
        confirmText="退出"
        variant="destructive"
        onConfirm={() => logout.mutateAsync()}
      />
    </aside>
  );
}
