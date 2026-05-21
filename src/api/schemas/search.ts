import { z } from "zod";

export const SearchContactSchema = z.object({
  uid: z.string(),
  name: z.string(),
  avatar: z.string().optional(),
});
export type SearchContact = z.infer<typeof SearchContactSchema>;

export const SearchGroupSchema = z.object({
  channel_id: z.string(),
  channel_type: z.number().default(2),
  name: z.string(),
  avatar: z.string().optional(),
});
export type SearchGroup = z.infer<typeof SearchGroupSchema>;

export const SearchFileSchema = z.object({
  message_id: z.string(),
  channel_id: z.string(),
  channel_type: z.number(),
  name: z.string(),
  size: z.number().optional(),
  url: z.string(),
});
export type SearchFile = z.infer<typeof SearchFileSchema>;

export const SearchMessageSchema = z.object({
  message_id: z.string(),
  channel_id: z.string(),
  channel_type: z.number(),
  from_uid: z.string(),
  text: z.string(),
  timestamp: z.number().optional(),
});
export type SearchMessage = z.infer<typeof SearchMessageSchema>;

export const SearchResultSchema = z.object({
  friends: z.array(SearchContactSchema).optional().default([]),
  groups: z.array(SearchGroupSchema).optional().default([]),
  files: z.array(SearchFileSchema).optional().default([]),
  messages: z.array(SearchMessageSchema).optional().default([]),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;
