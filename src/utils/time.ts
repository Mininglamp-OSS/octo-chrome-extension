import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { zhCN } from "date-fns/locale";

/** 会话列表里最近一条消息的时间戳格式 */
export function formatConversationTime(timestamp: number | Date): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "昨天";
  return format(date, "MM-dd");
}

/** 消息气泡内的相对时间，比如 "2 分钟前" */
export function formatRelativeTime(timestamp: number | Date): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  return formatDistanceToNowStrict(date, { locale: zhCN, addSuffix: true });
}

/** 详细时间戳，用于 tooltip / 详情页 */
export function formatFullTime(timestamp: number | Date): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  return format(date, "yyyy-MM-dd HH:mm:ss");
}

/** 气泡上方的消息时间标记：今天 → HH:mm；昨天 → 昨天 HH:mm；更早 → MM-dd HH:mm */
export function formatMessageTime(timestamp: number | Date): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return `昨天 ${format(date, "HH:mm")}`;
  return format(date, "MM-dd HH:mm");
}

/** 日期分隔栏：今天 → "今天"；昨天 → "昨天"；同年 → "MM月DD日"；跨年 → "yyyy年MM月DD日" */
export function formatDateSeparator(timestamp: number | Date): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  if (isToday(date)) return "今天";
  if (isYesterday(date)) return "昨天";
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) return format(date, "MM月dd日");
  return format(date, "yyyy年MM月dd日");
}
