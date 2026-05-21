import { Channel, Reminder } from "wukongimjssdk";
import { z } from "zod";

/** 后端 message/reminder/sync 返回的原始项 */
export const ReminderRawSchema = z.object({
  id: z.number(),
  channel_id: z.string(),
  channel_type: z.number(),
  message_id: z.string(),
  message_seq: z.number(),
  reminder_type: z.number(),
  text: z.string().optional(),
  data: z.unknown().optional(),
  is_locate: z.number().optional(),
  version: z.number(),
  done: z.number().optional(),
});
export type ReminderRaw = z.infer<typeof ReminderRawSchema>;

export const ReminderListSchema = z.array(ReminderRawSchema);

/** 把后端 raw shape 映射为 WKSDK Reminder 实例 */
export function toReminder(raw: ReminderRaw): Reminder {
  const r = new Reminder();
  r.channel = new Channel(raw.channel_id, raw.channel_type);
  r.reminderID = raw.id;
  r.messageID = raw.message_id;
  r.messageSeq = raw.message_seq;
  r.reminderType = raw.reminder_type;
  if (raw.text !== undefined) r.text = raw.text;
  if (raw.data !== undefined) r.data = raw.data;
  r.isLocate = raw.is_locate === 1;
  r.version = raw.version;
  r.done = raw.done === 1;
  return r;
}
