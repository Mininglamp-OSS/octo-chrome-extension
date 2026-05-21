import { create } from "zustand";

interface CategoriesUiStore {
  manageOpen: boolean;
  moveTarget: string | null;
  /** category_id -> collapsed (default false) */
  collapsed: Set<string>;
  /** 当前正在行内重命名的 category_id；null = 无 */
  renamingId: string | null;
  openManage: () => void;
  closeManage: () => void;
  openMoveTo: (groupNo: string) => void;
  closeMoveTo: () => void;
  toggleCollapse: (id: string) => void;
  openRename: (id: string) => void;
  closeRename: () => void;
}

export const useCategoriesUi = create<CategoriesUiStore>((set, get) => ({
  manageOpen: false,
  moveTarget: null,
  collapsed: new Set(),
  renamingId: null,
  openManage: () => set({ manageOpen: true }),
  closeManage: () => set({ manageOpen: false }),
  openMoveTo: (groupNo) => set({ moveTarget: groupNo }),
  closeMoveTo: () => set({ moveTarget: null }),
  toggleCollapse: (id) => {
    const next = new Set(get().collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ collapsed: next });
  },
  openRename: (id) => set({ renamingId: id }),
  closeRename: () => set({ renamingId: null }),
}));
