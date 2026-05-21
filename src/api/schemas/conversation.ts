import { z } from "zod";

/**
 * `conversation/sync` 单条 wire 格式（mirror packages/dmworkbase/src/Service/Convert.ts:197
 *  toConversation 读法）：
 *
 *   { channel_id, channel_type, unread, timestamp,
 *     recents: [ {payload, ...} ],     // 最后 N 条消息（msg_count 决定数量）
 *     stick: 0|1,                       // 置顶
 *     category_id, category_sort,
 *     space_unread?, space_last_message?,
 *     extra: { ... } }
 *
 * 留 .loose() passthrough 别的字段，后端加字段也不崩。
 */
export const ConversationSchema = z
  .object({
    channel_id: z.string(),
    channel_type: z.number(),
    unread: z.number().optional(),
    timestamp: z.number().optional(),
    recents: z.array(z.unknown()).optional(),
    stick: z.number().optional(),
    category_id: z.string().nullable().optional(),
    category_sort: z.number().optional(),
    space_unread: z.number().optional(),
    space_last_message: z.unknown().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();
export type Conversation = z.infer<typeof ConversationSchema>;

/**
 * mirror packages/dmworkdatasource/src/module.ts:285 的 syncConversationsCallback：
 *   POST conversation/sync  body: { msg_count: 1 }
 *   resp: { conversations: [...], users: [...], groups: [...] }
 * （不是 {cmd, data: array} —— 那是别的接口）
 */
export const ConversationSyncResponseSchema = z
  .object({
    conversations: z.array(ConversationSchema).optional(),
    users: z.array(z.unknown()).optional(),
    groups: z.array(z.unknown()).optional(),
  })
  .loose();
export type ConversationSyncResponse = z.infer<typeof ConversationSyncResponseSchema>;
