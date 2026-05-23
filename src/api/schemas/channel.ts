import { z } from "zod";

/**
 * 后端 `channels/{id}/{type}` 实际响应（mirror DataSourceModule.setChannelInfoCallback 读法）：
 * { channel: { channel_id, channel_type }, name, logo, mute, stick, online, remark, extra, ... }
 *
 * 注意：channel_id / channel_type 嵌在 `channel` 字段里，不是顶层。
 * 这里 loose() passthrough 其它字段，避免 mirror 后续加字段时 parse 崩。
 */
export const ChannelInfoSchema = z
  .object({
    channel: z
      .object({
        channel_id: z.string(),
        channel_type: z.number(),
      })
      .optional(),
    /** 顶层冗余字段（部分 endpoint 也提供） */
    channel_id: z.string().optional(),
    channel_type: z.number().optional(),
    name: z.string().optional(),
    avatar: z.string().optional(),
    logo: z.string().optional(),
    remark: z.string().optional(),
    status: z.number().optional(),
    forbidden: z.number().optional(),
    invite: z.number().optional(),
    notice: z.string().optional(),
    notify: z.number().optional(),
    mute: z.number().optional(),
    stick: z.number().optional(),
    top: z.number().optional(),
    online: z.number().optional(),
    last_offline: z.number().optional(),
    show_nick: z.number().optional(),
    save: z.number().optional(),
    category: z.string().optional(),
    /** 1 = AI / 机器人（与 octo-web datasource 行 117-118 同源） */
    robot: z.number().optional(),
    /** 部分接口用此字段：>0 视为 bot */
    bot_type: z.number().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();
export type ChannelInfo = z.infer<typeof ChannelInfoSchema>;

/**
 * 判定一个 channelInfo 是否是 AI/机器人。规则对齐 isMemberBot：
 *  - category === "bot"
 *  - robot === 1
 *  - bot_type > 0
 */
export function isChannelInfoBot(info: ChannelInfo | undefined): boolean {
  if (!info) return false;
  if (info.category === "bot") return true;
  if (info.robot === 1) return true;
  if (typeof info.bot_type === "number" && info.bot_type > 0) return true;
  return false;
}
