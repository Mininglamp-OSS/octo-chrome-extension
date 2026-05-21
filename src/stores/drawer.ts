import { create } from "zustand";

interface DrawerStore {
  info: boolean;
  contacts: boolean;
  openInfo: () => void;
  closeInfo: () => void;
  openContacts: () => void;
  closeContacts: () => void;
}

export const useDrawerStore = create<DrawerStore>((set) => ({
  info: false,
  contacts: false,
  openInfo: () => set({ info: true, contacts: false }),
  closeInfo: () => set({ info: false }),
  openContacts: () => set({ contacts: true, info: false }),
  closeContacts: () => set({ contacts: false }),
}));
