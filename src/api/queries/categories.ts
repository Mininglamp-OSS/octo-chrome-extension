import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { type CategoryItem, CategoryListSchema } from "../schemas/category";

export function useCategories(spaceId: string | null) {
  return useQuery({
    queryKey: ["categories", spaceId],
    enabled: Boolean(spaceId),
    async queryFn(): Promise<CategoryItem[]> {
      const data = await api.get(Endpoints.spaceCategories(spaceId!)).json();
      return CategoryListSchema.parse(data);
    },
  });
}

export function useCreateCategory(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn(payload: { name: string }): Promise<void> {
      if (!spaceId) throw new Error("spaceId required");
      await api.post(Endpoints.spaceCategories(spaceId), { json: payload }).json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["categories", spaceId] });
    },
  });
}

export function useUpdateCategory(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn(payload: { categoryId: string; name: string }): Promise<void> {
      if (!spaceId) throw new Error("spaceId required");
      await api
        .put(Endpoints.category(spaceId, payload.categoryId), { json: { name: payload.name } })
        .json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["categories", spaceId] });
    },
  });
}

export function useDeleteCategory(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn(categoryId: string): Promise<void> {
      if (!spaceId) throw new Error("spaceId required");
      await api.delete(Endpoints.category(spaceId, categoryId)).json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["categories", spaceId] });
    },
  });
}
