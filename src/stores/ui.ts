import { create } from "zustand";

export type DrawerKind = null | "info" | "contacts" | "search" | "settings" | "space";

interface UIStore {
  drawer: DrawerKind;
  lightbox: { url: string; name: string } | null;
  openDrawer: (kind: Exclude<DrawerKind, null>) => void;
  closeDrawer: () => void;
  openLightbox: (payload: { url: string; name: string }) => void;
  closeLightbox: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  drawer: null,
  lightbox: null,
  openDrawer: (kind) => set({ drawer: kind }),
  closeDrawer: () => set({ drawer: null }),
  openLightbox: (payload) => set({ lightbox: payload }),
  closeLightbox: () => set({ lightbox: null }),
}));
