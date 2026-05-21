import { z } from "zod";

export const CategoryGroupSchema = z.object({
  group_no: z.string(),
  name: z.string(),
  category_sort: z.number(),
});
export type CategoryGroup = z.infer<typeof CategoryGroupSchema>;

export const CategoryItemSchema = z.object({
  category_id: z.string().nullable(),
  name: z.string(),
  sort: z.number(),
  groups: z.array(CategoryGroupSchema),
  is_default: z.boolean().optional(),
});
export type CategoryItem = z.infer<typeof CategoryItemSchema>;

export const CategoryListSchema = z.array(CategoryItemSchema);
