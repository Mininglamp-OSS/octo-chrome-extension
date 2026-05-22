import { z } from "zod";

// 后端在 name 字段里会包 <mark>关键字</mark> 高亮标签（即使空 kw 也会包空 mark），统一剥离
function stripMark(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/<\/?mark>/gi, "");
}

// 后端字段兼容：联系人可能返 uid/name 也可能返 channel_id/channel_name/channel_remark（mirror 风格）
export const SearchContactSchema = z
  .object({
    uid: z.string().optional(),
    channel_id: z.string().optional(),
    name: z.string().optional(),
    channel_name: z.string().optional(),
    channel_remark: z.string().optional(),
    avatar: z.string().optional(),
  })
  .transform((v) => ({
    uid: v.uid ?? v.channel_id ?? "",
    name: stripMark(v.channel_remark || v.channel_name || v.name),
    avatar: v.avatar,
  }));
export type SearchContact = z.infer<typeof SearchContactSchema>;

// 群组：mirror 返 channel_id/channel_name/channel_remark/member_count
export const SearchGroupSchema = z
  .object({
    channel_id: z.string(),
    channel_type: z.number().optional(),
    name: z.string().optional(),
    channel_name: z.string().optional(),
    channel_remark: z.string().optional(),
    avatar: z.string().optional(),
    member_count: z.number().optional(),
  })
  .transform((v) => ({
    channel_id: v.channel_id,
    channel_type: v.channel_type ?? 2,
    name: stripMark(v.channel_remark || v.channel_name || v.name),
    avatar: v.avatar,
    member_count: v.member_count,
  }));
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

// 单条 parse 失败时不连累整组结果，丢弃错误项
function tolerantArray<T extends z.ZodTypeAny>(item: T) {
  return z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((arr) =>
      arr.reduce<z.infer<T>[]>((acc, raw) => {
        const r = item.safeParse(raw);
        if (r.success) acc.push(r.data);
        return acc;
      }, []),
    );
}

export const SearchResultSchema = z.object({
  friends: tolerantArray(SearchContactSchema).transform((arr) => arr.filter((c) => c.uid !== "")),
  groups: tolerantArray(SearchGroupSchema),
  files: tolerantArray(SearchFileSchema),
  messages: tolerantArray(SearchMessageSchema),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;
