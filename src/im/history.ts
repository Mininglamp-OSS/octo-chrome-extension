import WKSDK, { Channel, Message, MessageStatus, PullMode } from "wukongimjssdk";
import { api } from "@/api/client";
import { Endpoints } from "@/api/endpoints";
import { type MessageView, toMessageView } from "@/im/message";

export interface FetchHistoryOpts {
  /** 起点 msg_seq；约定：向下拉历史时传 minSeq-1（mirror vm.ts:1568） */
  startMessageSeq?: number;
  /** 终点 msg_seq，0 表示无下界 */
  endMessageSeq?: number;
  /** 单次条数 */
  limit?: number;
  /** Down=向下（更早）, Up=向上（更晚） */
  pullMode?: PullMode;
}

interface SyncResp {
  messages?: unknown[];
}

interface RawMsg {
  message_id?: number | string;
  message_idstr?: string;
  message_seq?: number;
  client_seq?: number;
  client_msg_no?: string;
  channel_id?: string;
  channel_type?: number;
  from_uid?: string;
  timestamp?: number;
  is_deleted?: number;
  revoke?: number;
  payload?: { type?: number } & Record<string, unknown>;
  message_extra?: { revoke?: number; revoker?: string } & Record<string, unknown>;
  [k: string]: unknown;
}

/** mirror Convert.stringToUint8Array */
function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** mirror Convert.toMessage：用 HTTP 响应里的 msgMap 还原一个 WKSDK Message */
function jsonToMessage(map: RawMsg): Message {
  const m = new Message();
  m.messageID = map.message_idstr ?? String(map.message_id ?? "");
  m.channel = new Channel(String(map.channel_id ?? ""), Number(map.channel_type ?? 0));
  m.messageSeq = Number(map.message_seq ?? 0);
  if (map.client_seq != null) m.clientSeq = Number(map.client_seq);
  if (map.client_msg_no != null) m.clientMsgNo = String(map.client_msg_no);
  if (map.from_uid != null) m.fromUID = String(map.from_uid);
  m.timestamp = Number(map.timestamp ?? 0);
  m.status = MessageStatus.Normal;

  const payload = map.payload;
  const contentType = payload?.type ?? 0;
  const content = WKSDK.shared().getMessageContent(contentType);
  if (payload) {
    content.decode(strToBytes(JSON.stringify(payload)));
  }
  // 兜底：确保 content.contentObj 包含 raw payload 的扩展字段（如 space_id）。
  // SDK 基类 MessageContent.decode 会设 contentObj，但子类若覆盖 decode 可能漏设。
  if (payload && (content as { contentObj?: unknown }).contentObj == null) {
    (content as { contentObj?: unknown }).contentObj = payload;
  }
  m.content = content;

  m.isDeleted = map.is_deleted === 1;

  // remoteExtra（撤回标记 / 撤回人）
  if (map.message_extra) {
    if (map.message_extra.revoke === 1) m.remoteExtra.revoke = true;
    if (map.message_extra.revoker) m.remoteExtra.revoker = String(map.message_extra.revoker);
  } else if (map.revoke === 1) {
    m.remoteExtra.revoke = true;
  }

  return m;
}

/**
 * mirror packages/dmworkdatasource/src/conversation.ts:42-66 的等价实现：
 * 直接 POST `message/channel/sync`。
 *
 * **请求体跟 mirror curl 严格对齐**：opts 字段没传时 body 里也不带（不要给默认值 0），
 * server 对 "start_message_seq=undefined" 跟 "start_message_seq=0 + pull_mode=0" 走的
 * 是不同分支 —— 前者返回最新一页，后者返回 seq 1 开始的最旧一页。
 */
export async function fetchChannelHistory(
  channelId: string,
  channelType: number,
  opts: FetchHistoryOpts = {},
): Promise<MessageView[]> {
  const body: Record<string, unknown> = {
    limit: opts.limit ?? 30,
    channel_id: channelId,
    channel_type: channelType,
  };
  if (opts.startMessageSeq != null) body.start_message_seq = opts.startMessageSeq;
  if (opts.endMessageSeq != null) body.end_message_seq = opts.endMessageSeq;
  if (opts.pullMode != null) body.pull_mode = opts.pullMode;
  console.info("[octo:history] POST message/channel/sync →", body);
  const t0 = Date.now();
  let resp: SyncResp;
  try {
    resp = (await api.post(Endpoints.messageChannelSync, { json: body }).json()) as SyncResp;
  } catch (err) {
    console.error("[octo:history] POST message/channel/sync FAILED", {
      ms: Date.now() - t0,
      err: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
    throw err;
  }
  const list = resp?.messages ?? [];
  console.info("[octo:history] POST message/channel/sync ←", {
    ms: Date.now() - t0,
    rawCount: list.length,
    keys: resp && typeof resp === "object" ? Object.keys(resp) : [],
    firstSeq: list[0] && typeof list[0] === "object" ? (list[0] as RawMsg).message_seq : undefined,
    lastSeq:
      list.length > 0 && typeof list[list.length - 1] === "object"
        ? (list[list.length - 1] as RawMsg).message_seq
        : undefined,
  });
  const out: MessageView[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as RawMsg;
    if (r.is_deleted === 1) continue;
    const view = toMessageView(jsonToMessage(r));
    // 直接从 HTTP 原始 payload 取 space_id，绕开 SDK content decode 的不确定性
    const payloadSpaceId = (r.payload as { space_id?: unknown } | undefined)?.space_id;
    if (typeof payloadSpaceId === "string" && payloadSpaceId) {
      view.spaceId = payloadSpaceId;
    }
    out.push(view);
  }
  return out;
}

export { PullMode };
