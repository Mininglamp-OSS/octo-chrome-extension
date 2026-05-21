import { Folder } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCategories } from "@/api/queries/categories";
import { useMoveGroupToCategory } from "@/api/queries/categoryActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSpaceStore } from "@/stores/space";
import { cn } from "@/utils/cn";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

export function MoveToCategoryDialog({
  open,
  onClose,
  groupNo,
}: {
  open: boolean;
  onClose: () => void;
  groupNo: string;
}) {
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  const { data: categories } = useCategories(spaceId);
  const move = useMoveGroupToCategory(spaceId);
  const [pickedId, setPickedId] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!pickedId) return;
    try {
      await move.mutateAsync({ groupNo, categoryId: pickedId });
      toast.success("已移动");
      onClose();
    } catch (err) {
      toast.error(extractErrorMsg(err) || "移动失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>移动到分组</DialogTitle>
          <DialogDescription>选择目标分组</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          {(categories ?? []).map((c) => (
            <button
              key={c.category_id ?? "_default"}
              type="button"
              onClick={() => c.category_id && setPickedId(c.category_id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-(--color-accent)/40",
                pickedId === c.category_id && "border-(--color-primary) bg-(--color-primary)/10",
              )}
            >
              <Folder className="h-4 w-4 text-(--color-muted-foreground)" />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-[10px] text-(--color-muted-foreground)">
                {c.groups.length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" disabled={!pickedId || move.isPending} onClick={() => void submit()}>
            确定
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
