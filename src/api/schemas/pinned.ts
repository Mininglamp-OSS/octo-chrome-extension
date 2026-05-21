import { z } from "zod";

export const PinnedItemSchema = z.object({
  channel_id: z.string(),
  channel_type: z.number(),
  sort_order: z.number(),
});
export type PinnedItem = z.infer<typeof PinnedItemSchema>;

export const PinnedListSchema = z.array(PinnedItemSchema);
