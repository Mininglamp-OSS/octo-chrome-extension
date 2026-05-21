import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useCategories,
  useDeleteCategory,
  useUpdateCategory,
} from "@/api/queries/categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSpaceStore } from "@/stores/space";
import { extractErrorMsg } from "@/utils/extractErrorMsg";
import { CreateCategoryModal } from "./CreateCategoryModal";

export function CategoriesManageModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  const { data: categories } = useCategories(spaceId);
  const update = useUpdateCategory(spaceId);
  const del = useDeleteCategory(spaceId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [creating, setCreating] = useState(false);

  async function commitRename(id: string): Promise<void> {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await update.mutateAsync({ categoryId: id, name: editName.trim() });
      setEditingId(null);
      toast.success("已重命名");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "重命名失败");
    }
  }

  async function onDelete(id: string, name: string): Promise<void> {
    if (!confirm(`删除分组「${name}」？组内群聊会回到默认分组。`)) return;
    try {
      await del.mutateAsync(id);
      toast.success("已删除");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "删除失败");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>管理分组</DialogTitle>
            <DialogDescription>当前 Space 的会话分组</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            {(categories ?? []).map((c) => {
              const isEditing = editingId === c.category_id;
              return (
                <div
                  key={c.category_id ?? "_default"}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                >
                  {isEditing ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 flex-1"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && c.category_id && void commitRename(c.category_id)}
                    />
                  ) : (
                    <span className="flex-1 truncate text-sm">
                      {c.name}
                      <span className="ml-2 text-[10px] text-(--color-muted-foreground)">
                        {c.groups.length} 个群
                      </span>
                    </span>
                  )}
                  {!c.is_default && c.category_id && !isEditing && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingId(c.category_id);
                          setEditName(c.name);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-(--color-destructive)"
                        onClick={() => void onDelete(c.category_id!, c.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setCreating(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> 新建分组
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateCategoryModal
        open={creating}
        onClose={() => setCreating(false)}
        existingNames={(categories ?? []).map((c) => c.name)}
      />
    </>
  );
}
