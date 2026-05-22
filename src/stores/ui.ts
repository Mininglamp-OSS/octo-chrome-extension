import { create } from "zustand";
import type { MergeForwardContent } from "@/messages/mergeForward";

export type DrawerKind = null | "info" | "contacts" | "search" | "settings" | "space";

interface UIStore {
  drawer: DrawerKind;
  lightbox: { url: string; name: string } | null;
  /** 合并转发详情面板的内容栈：空 = 关闭；非空 = 顶层 .at(-1) 为当前显示内容 */
  mergeForwardStack: MergeForwardContent[];
  openDrawer: (kind: Exclude<DrawerKind, null>) => void;
  closeDrawer: () => void;
  openLightbox: (payload: { url: string; name: string }) => void;
  closeLightbox: () => void;
  openMergeForward: (content: MergeForwardContent) => void;
  pushMergeForward: (content: MergeForwardContent) => void;
  popMergeForward: () => void;
  closeMergeForward: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  drawer: null,
  lightbox: null,
  mergeForwardStack: [],
  openDrawer: (kind) => set({ drawer: kind }),
  closeDrawer: () => set({ drawer: null }),
  openLightbox: (payload) => set({ lightbox: payload }),
  closeLightbox: () => set({ lightbox: null }),
  openMergeForward: (content) => set({ mergeForwardStack: [content] }),
  pushMergeForward: (content) =>
    set((s) => ({ mergeForwardStack: [...s.mergeForwardStack, content] })),
  popMergeForward: () => set((s) => ({ mergeForwardStack: s.mergeForwardStack.slice(0, -1) })),
  closeMergeForward: () => set({ mergeForwardStack: [] }),
}));
