/**
 * 子区 (thread) channel 编码规则：`parent:thread_no`
 * 沿用 mirror 的 parseThreadChannelId 行为。
 */

export interface Thread {
  no: string;
  parent: { channelId: string; channelType: number };
  createdAt?: number;
  /** 头消息预览（用于面板标题） */
  firstMessage?: string;
}

const SEP = ":";

export function parseThreadChannelId(channelId: string): { parent: string; thread: string } | null {
  const idx = channelId.indexOf(SEP);
  if (idx <= 0 || idx === channelId.length - 1) return null;
  return {
    parent: channelId.slice(0, idx),
    thread: channelId.slice(idx + 1),
  };
}

export function buildThreadChannelId(parent: string, thread: string): string {
  return `${parent}${SEP}${thread}`;
}

export function isThreadChannelId(channelId: string): boolean {
  return parseThreadChannelId(channelId) !== null;
}
