import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import { CategoryHeader } from "./CategoryHeader";

interface CategorySectionProps {
  /** 真实 category_id；虚拟段（私聊 / 未分组）传 null */
  categoryId: string | null;
  /** 兼容旧 API，新版忽略 */
  sortableId?: string | null;
  name: string;
  count: number;
  unreadCount: number;
  hasMention: boolean;
  collapsed: boolean;
  /** 后端 is_default：仍渲染、可作 drop target，但不可拖排序 */
  isDefault: boolean;
  orderedCategoryIds: string[];
  onToggle: () => void;
  topPx: number;
  heightPx: number;
}

/**
 * 对齐 octo-web ConversationListGrouped 的 dnd 接线：
 *  - useDroppable 给所有真实 category（含 is_default）—— 接受 group / category drop
 *  - useDraggable 仅非默认 category 启用 —— handle hover 出现时可拖排序
 *  - 不应用 transform 到 inline style（兼容外层 virtualizer absolute 定位）
 *  - 视觉跟手由 ConversationList 顶层 DragOverlay 渲染 ghost
 */
export function CategorySection({
  categoryId,
  name,
  count,
  unreadCount,
  hasMention,
  collapsed,
  isDefault,
  orderedCategoryIds,
  onToggle,
  topPx,
  heightPx,
}: CategorySectionProps) {
  const dndId = categoryId ? `cat::${categoryId}` : "";
  const droppable = useDroppable({
    id: dndId || `noop::${name}`,
    data: { type: "category", categoryId },
    disabled: !categoryId,
  });
  const draggable = useDraggable({
    id: dndId || `noop::${name}`,
    data: { type: "category", categoryId },
    disabled: !categoryId || isDefault,
  });

  function setNodeRef(el: HTMLElement | null): void {
    droppable.setNodeRef(el);
    draggable.setNodeRef(el);
  }

  const dragHandleProps =
    !categoryId || isDefault
      ? undefined
      : { ...draggable.attributes, ...draggable.listeners };

  const isOver = Boolean(categoryId) && droppable.isOver;
  // 从 droppable.active 读当前拖的是 category 还是 group，决定 drop 视觉：
  //  - category：排序场景，顶部插入线
  //  - group：移入容器场景，整段填充背景 + 描边
  const activeType =
    (droppable.active?.data.current as { type?: string } | undefined)?.type;
  const isOverForSort = isOver && activeType === "category";
  const isOverForMove = isOver && activeType === "group";

  const style: CSSProperties = {
    top: topPx,
    height: heightPx,
    opacity: draggable.isDragging ? 0.4 : undefined,
    background: isOverForMove
      ? "color-mix(in oklch, #6569E8 10%, var(--color-background))"
      : "var(--color-background)",
    boxShadow: isOverForMove
      ? "inset 0 0 0 1px color-mix(in oklch, #6569E8 50%, transparent)"
      : undefined,
    borderRadius: isOverForMove ? 6 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      className="absolute right-0 left-0 px-2 transition-colors"
      style={style}
    >
      {/* sort 场景：顶部 2px 主色横线，指示"插入到此项之前" */}
      {isOverForSort && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-2 left-2 h-[2px] rounded-full"
          style={{ background: "#6569E8" }}
        />
      )}
      <CategoryHeader
        categoryId={categoryId}
        name={name}
        count={count}
        unreadCount={unreadCount}
        hasMention={hasMention}
        collapsed={collapsed}
        isDefault={isDefault}
        orderedCategoryIds={orderedCategoryIds}
        onToggle={onToggle}
        dragHandleProps={dragHandleProps}
      />
    </div>
  );
}
