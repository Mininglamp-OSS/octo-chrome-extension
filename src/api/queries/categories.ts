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

/** 批量重排分组顺序 —— mirror CategoryService.sort */
export function useSortCategories(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn(categoryIds: string[]): Promise<void> {
      if (!spaceId) throw new Error("spaceId required");
      await api
        .put(Endpoints.sortCategories(spaceId), { json: { category_ids: categoryIds } })
        .json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["categories", spaceId] });
    },
  });
}

/** 把群聊移动到指定分组 —— mirror CategoryService.moveGroupToCategory，带乐观更新 */
export function useMoveGroupToCategory(spaceId: string | null) {
  const qc = useQueryClient();
  const key = ["categories", spaceId] as const;
  return useMutation({
    async mutationFn(payload: { groupNo: string; categoryId: string }): Promise<void> {
      await api
        .put(Endpoints.moveGroupToCategory(payload.groupNo), {
          json: { category_id: payload.categoryId },
        })
        .json();
    },
    async onMutate(payload) {
      // 乐观更新：把 groupNo 从原 category 拿出来塞到目标 category，先反馈到 UI
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CategoryItem[]>(key);
      if (!prev) return { prev };
      const next: CategoryItem[] = prev.map((cat) => ({
        ...cat,
        groups: cat.groups.filter((g) => g.group_no !== payload.groupNo),
      }));
      const targetIdx = next.findIndex((c) => c.category_id === payload.categoryId);
      if (targetIdx >= 0) {
        const target = next[targetIdx];
        if (target) {
          // 把 group_no 注入目标分组（name 可不准，会在后续 invalidate 后被刷新覆盖）
          const moved = prev
            .flatMap((c) => c.groups)
            .find((g) => g.group_no === payload.groupNo);
          if (moved) {
            next[targetIdx] = { ...target, groups: [moved, ...target.groups] };
          }
        }
      }
      qc.setQueryData(key, next);
      return { prev };
    },
    onError(_err, _payload, ctx) {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled() {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}
