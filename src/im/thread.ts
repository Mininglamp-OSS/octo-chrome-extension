/**
 * 子区 (thread) channel 编码规则：`parent:thread_no`
 *
 * ⚠️ 协议未对齐警告：mirror/octo-server 实际下发的子区 channelId 是
 * `{parentGroupNo}____{shortId}`（4 个下划线分隔，见 hooks/useExpandedThreadGroups.ts:49）。
 * 本文件的 `:` 分隔仅服务于 MessageBubble → ThreadSheet 「从消息打开子区」入口，
 * 是前端内部临时构造的 channelId（parent + messageId），尚未对接后端
 * `message/channel/sync`，用此 ID 拉历史 / 发消息都会失败。
 *
 * 子区功能完整接入后端时需统一改用 `____` 分隔，并复用
 * `useExpandedThreadGroups.parseParentGroupNo` —— 避免再出现两套 ID 协议。
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
