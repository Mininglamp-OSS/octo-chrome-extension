import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";

/**
 * 后端 sticker 接口（对照 mirror packages/dmworkdatasource/src/datasource.ts）
 *   GET sticker/user/category → [{ category, cover, name?, ... }]
 *   GET sticker/user/sticker?category=xxx → { list: [{ path, placeholder, format, category, ... }] }
 */

export interface StickerCategory {
  category: string;
  cover: string;
  name?: string;
}

export interface Sticker {
  path: string;
  placeholder: string;
  format: string;
  category: string;
}

export function useStickerCategories() {
  return useQuery<StickerCategory[]>({
    queryKey: ["sticker-categories"],
    async queryFn() {
      const r = await api.get(Endpoints.stickerCategories).json<unknown>();
      if (!Array.isArray(r)) return [];
      return (r as StickerCategory[]).filter((c) => c.category);
    },
    staleTime: 5 * 60_000,
  });
}

export function useStickers(category: string | undefined) {
  return useQuery<Sticker[]>({
    queryKey: ["stickers", category ?? ""],
    enabled: !!category,
    async queryFn() {
      if (!category) return [];
      const r = await api.get(Endpoints.stickers(category)).json<unknown>();
      const list = (r as { list?: Sticker[] } | null)?.list ?? [];
      return list.filter((s) => s.path);
    },
    staleTime: 5 * 60_000,
  });
}
