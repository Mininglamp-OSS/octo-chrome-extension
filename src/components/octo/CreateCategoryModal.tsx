import { useState } from "react";
import { toast } from "sonner";
import { useCreateCategory } from "@/api/queries/categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSpaceStore } from "@/stores/space";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

export function CreateCategoryModal({
  open,
  onClose,
  existingNames = [],
}: {
  open: boolean;
  onClose: () => void;
  existingNames?: string[];
}) {
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  const create = useCreateCategory(spaceId);
  const [name, setName] = useState("");

  async function submit(): Promise<void> {
    const v = name.trim();
    if (!v) return;
    if (existingNames.includes(v)) {
      toast.error("已存在同名分组");
      return;
    }
    try {
      await create.mutateAsync({ name: v });
      setName("");
      onClose();
      toast.success("已创建分组");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "创建失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>新建分组</DialogTitle>
          <DialogDescription>分组用于把多个群聊归类管理</DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="分组名称"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && void submit()}
        />
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" disabled={!name.trim() || create.isPending} onClick={() => void submit()}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
