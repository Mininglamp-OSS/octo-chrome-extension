import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import {
  useDeleteCategory,
  useSortCategories,
  useUpdateCategory,
} from "@/api/queries/categories";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useCategoriesUi } from "@/stores/categoriesUi";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";
import { cn } from "@/utils/cn";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

interface CategoryHeaderProps {
  /** Stable id：真实 category_id，默认分组传 null（mirror is_default 段） */
  categoryId: string | null;
  name: string;
  count: number;
  unreadCount: number;
  hasMention: boolean;
  collapsed: boolean;
  isDefault: boolean;
  orderedCategoryIds: string[];
  onToggle: () => void;
  /** useSortable 透传的 attributes + listeners；默认分组传 undefined */
  dragHandleProps?: Record<string, unknown>;
}

/**
 * mirror CategoryHeader 等价：拖拽 handle / 折叠箭头 / 名称 / 折叠时 (N) +
 * 未读 + @ badge / 行内重命名 / 右键菜单。
 */
export function CategoryHeader({
  categoryId,
  name,
  count,
  unreadCount,
  hasMention,
  collapsed,
  isDefault,
  orderedCategoryIds,
  onToggle,
  dragHandleProps,
}: CategoryHeaderProps) {
  const spaceId = useSpaceStore(selectCurrentSpaceId);
  const renamingId = useCategoriesUi((s) => s.renamingId);
  const openRename = useCategoriesUi((s) => s.openRename);
  const closeRename = useCategoriesUi((s) => s.closeRename);
  const isRenaming = renamingId !== null && renamingId === categoryId;

  const updateCategory = useUpdateCategory(spaceId);
  const deleteCategory = useDeleteCategory(spaceId);
  const sortCategories = useSortCategories(spaceId);

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [draftName, setDraftName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setDraftName(name);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isRenaming, name]);

  function onContextMenu(e: React.MouseEvent): void {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  async function commitRename(): Promise<void> {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === name || !categoryId) {
      closeRename();
      return;
    }
    try {
      await updateCategory.mutateAsync({ categoryId, name: trimmed });
      toast.success("已重命名");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "重命名失败");
    } finally {
      closeRename();
    }
  }

  async function onDelete(): Promise<void> {
    if (!categoryId) return;
    const msg =
      count > 0
        ? `分组「${name}」含 ${count} 个群聊，删除后会被移到「未分组」。确认删除？`
        : `删除分组「${name}」？`;
    if (!confirm(msg)) return;
    try {
      await deleteCategory.mutateAsync(categoryId);
      toast.success("已删除分组");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "删除失败");
    }
  }

  async function shift(direction: -1 | 1): Promise<void> {
    if (!categoryId) return;
    const idx = orderedCategoryIds.indexOf(categoryId);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= orderedCategoryIds.length) return;
    const next = orderedCategoryIds.slice();
    const a = next[idx];
    const b = next[target];
    if (a === undefined || b === undefined) return;
    next[idx] = b;
    next[target] = a;
    try {
      await sortCategories.mutateAsync(next);
    } catch (err) {
      toast.error(extractErrorMsg(err) || "排序失败");
    }
  }

  if (isRenaming) {
    return (
      <div className="flex h-7 items-center gap-1 rounded-md bg-(--color-accent)/40 px-1">
        <input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commitRename();
            } else if (e.key === "Escape") {
              e.preventDefault();
              closeRename();
            }
          }}
          onBlur={() => void commitRename()}
          className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
        />
      </div>
    );
  }

  const showCollapseBadge =
    collapsed && !isDefault && (unreadCount > 0 || hasMention);

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        onDoubleClick={(e) => {
          if (isDefault || !categoryId) return;
          e.stopPropagation();
          openRename(categoryId);
        }}
        onContextMenu={onContextMenu}
        className={cn(
          "group flex h-7 w-full items-center gap-1 rounded-md px-1 text-[12px]",
          "text-(--color-muted-foreground) transition-colors hover:bg-(--color-accent)/50 hover:text-(--color-foreground)",
        )}
      >
        {/* 6 圆点拖拽 handle —— 仅非默认分组、hover 时显示 */}
        {dragHandleProps ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: dnd-kit 提供 role/tabIndex via attributes
          <span
            className="pointer-events-none flex h-4 w-3 shrink-0 cursor-grab items-center justify-center text-(--color-muted-foreground) opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            {...dragHandleProps}
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
              <circle cx="3" cy="3" r="1.2" fill="currentColor" />
              <circle cx="7" cy="3" r="1.2" fill="currentColor" />
              <circle cx="3" cy="7" r="1.2" fill="currentColor" />
              <circle cx="7" cy="7" r="1.2" fill="currentColor" />
              <circle cx="3" cy="11" r="1.2" fill="currentColor" />
              <circle cx="7" cy="11" r="1.2" fill="currentColor" />
            </svg>
          </span>
        ) : (
          <span className="h-4 w-3 shrink-0" aria-hidden="true" />
        )}

        {collapsed ? (
          <ChevronRight className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        )}

        <span className="truncate font-medium">
          {name}
          {collapsed && count > 0 && (
            <span className="ml-1 text-(--color-muted-foreground)/70">({count})</span>
          )}
        </span>

        {showCollapseBadge && (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {unreadCount > 0 && (
              <span className="inline-flex h-3 min-w-3 items-center justify-center rounded-full bg-(--color-destructive) px-1 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            {hasMention && (
              <span className="inline-flex h-3 min-w-3 items-center justify-center rounded-full bg-(--color-destructive)/15 px-1 text-[10px] font-semibold leading-none text-(--color-destructive)">
                @
              </span>
            )}
          </span>
        )}
      </button>

      {menu && (
        <DropdownMenu open onOpenChange={(o) => !o && setMenu(null)}>
          <DropdownMenuContent
            align="start"
            className="w-36"
            style={
              { position: "fixed", left: menu.x, top: menu.y } as CSSProperties
            }
          >
            <DropdownMenuItem disabled>新建群聊</DropdownMenuItem>
            {!isDefault && categoryId && (
              <DropdownMenuItem
                onSelect={() => {
                  openRename(categoryId);
                  setMenu(null);
                }}
              >
                重命名
              </DropdownMenuItem>
            )}
            {!isDefault && (
              <>
                <DropdownMenuItem
                  onSelect={() => {
                    void shift(-1);
                    setMenu(null);
                  }}
                >
                  上移
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void shift(1);
                    setMenu(null);
                  }}
                >
                  下移
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-(--color-destructive)"
                  onSelect={() => {
                    void onDelete();
                    setMenu(null);
                  }}
                >
                  删除分组
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
