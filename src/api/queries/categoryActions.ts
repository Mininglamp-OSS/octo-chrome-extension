import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";

/**
 * 把一个群移到指定 category（mirror: PUT /groups/{groupNo}/category, body { category_id }）
 * 移出分类时也传一个 category_id（mirror PR #1007 后默认分类有 UUID）
 */
export function useMoveGroupToCategory(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn(payload: { groupNo: string; categoryId: string }): Promise<void> {
      await api
        .put(Endpoints.moveGroupToCategory(payload.groupNo), {
          json: { category_id: payload.categoryId },
        })
        .json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["categories", spaceId] });
    },
  });
}

export function useSortCategories(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn(payload: { categoryIds: string[] }): Promise<void> {
      if (!spaceId) return;
      await api
        .put(Endpoints.sortCategories(spaceId), { json: { category_ids: payload.categoryIds } })
        .json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["categories", spaceId] });
    },
  });
}
