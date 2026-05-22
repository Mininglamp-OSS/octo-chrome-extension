import {
  Mention as WKMention,
  MessageContent as WKMessageContent,
  Reply as WKReply,
} from "wukongimjssdk";

/** WKSDK 注册号 —— 模块 index.ts 和 SDK class 共用，避免漂移 */
export const TEXT_TYPE = 1 as const;

export interface MentionEntity {
  uid: string;
  offset: number;
  length: number;
}

/**
 * 引用消息 UI 投影。
 *
 * 协议字段（mirror Conversation 发送 + SDK Reply.decode）：
 *   { message_id, message_seq, from_uid, from_name, payload }
 *
 * - 发送链路：fromUI 把 content（SerializedContent）rehydrate 成 SDK MessageContent，
 *   组装成 SDK `Reply` 实例赋给 `this.reply`，SDK 基类 encode 自动把它放进
 *   contentObj.reply。`content` 字段仅在 UI → SDK 这一程使用。
 * - 接收链路：decodeJSON 从 `this.reply`（SDK 基类已 decode）回填 UI 字段，
 *   `digest` 从 `reply.content.conversationDigest` 或 contentObj.content 兜底拿。
 */
export interface ReplyInfo {
  messageId: string;
  messageSeq: number;
  fromUid: string;
  fromName: string;
  digest: string;
  /** 仅发送链路用 —— 原消息 SerializedContent，转成 SDK Reply.content 用于 payload */
  content?: unknown;
}

export interface TextContent {
  text: string;
  /** TipTap mention/atUids 等结构 */
  mentionUids?: string[];
  /** 是否 @所有人 */
  mentionAll?: boolean;
  /** mention 精确偏移，渲染时按此高亮 */
  mentionEntities?: MentionEntity[];
  /** 引用消息（reply） */
  replyInfo?: ReplyInfo;
}

/**
 * 协议要点（对照 mirror MentionModel + WKSDK MessageContent.encode）：
 *   {
 *     "type": 1,
 *     "content": "Hello @张三 @李四",
 *     "mention": { "all": 1, "uids": [...], "entities": [{uid,offset,length},...] },
 *     "reply": { message_id, message_seq, from_uid, from_name, payload }
 *   }
 * - mention / reply 字段由 SDK 基类 encode() 自动生成（前提：this.mention / this.reply 已赋值）。
 * - mention.entities 是 mirror 自有扩展，SDK 不识别，我们 override encode() 在 SDK 序列化后注入。
 * - reply 走 SDK 标准路径，不再用扩展字段绕开。
 */
export class TextMessage extends WKMessageContent {
  text = "";
  mentionEntities: MentionEntity[] = [];

  constructor(text = "") {
    super();
    this.text = text;
  }

  override get contentType(): number {
    return TEXT_TYPE;
  }

  /** 便捷读访问：mention 在 SDK 基类的 .mention 上 */
  get mentionUids(): string[] {
    return this.mention?.uids ?? [];
  }

  get mentionAll(): boolean {
    return this.mention?.all === true;
  }

  /**
   * UI 投影的 replyInfo（从 SDK 基类的 this.reply 派生）。无 reply 时返回 undefined。
   * `digest` 字段留给 text/index.ts 的 toUI 用 registry.digest 兜底派生（避免本类引 registry）
   */
  get replyInfo(): ReplyInfo | undefined {
    const r = this.reply;
    if (!r) return undefined;
    return {
      messageId: r.messageID ?? "",
      messageSeq: r.messageSeq ?? 0,
      fromUid: r.fromUID ?? "",
      fromName: r.fromName ?? "",
      digest: "",
    };
  }

  setMention(opts: { all?: boolean; uids?: string[]; entities?: MentionEntity[] }): void {
    const all = opts.all === true;
    const uids = opts.uids ?? [];
    if (!all && uids.length === 0 && !opts.entities?.length) {
      this.mention = undefined;
      this.mentionEntities = [];
      return;
    }
    const m = new WKMention();
    m.all = all;
    if (uids.length) m.uids = uids;
    this.mention = m;
    this.mentionEntities = opts.entities ?? [];
  }

  /**
   * 设置引用（发送链路用）。content 是 SDK MessageContent 子类实例（原引用消息内容），
   * 让 SDK Reply.encode 能编出 payload。
   */
  setReply(opts: {
    messageId: string;
    messageSeq: number;
    fromUid: string;
    fromName: string;
    content?: WKMessageContent;
  }): void {
    const r = new WKReply();
    r.messageID = opts.messageId;
    r.messageSeq = opts.messageSeq;
    r.fromUID = opts.fromUid;
    r.fromName = opts.fromName;
    if (opts.content) r.content = opts.content;
    this.reply = r;
  }

  override decodeJSON(content: Record<string, unknown>): void {
    this.text = String(content.content ?? content.text ?? "");
    // SDK 基类的 decode() 已把 mention / reply 填好；这里只读 mention.entities（SDK 不识别）。
    const m = content.mention as Record<string, unknown> | undefined;
    const entities = m?.entities;
    this.mentionEntities = Array.isArray(entities)
      ? (entities as unknown[])
          .map((e) => {
            if (!e || typeof e !== "object") return null;
            const o = e as Record<string, unknown>;
            const uid = typeof o.uid === "string" ? o.uid : "";
            const offset = typeof o.offset === "number" ? o.offset : -1;
            const length = typeof o.length === "number" ? o.length : -1;
            if (!uid || offset < 0 || length <= 0) return null;
            return { uid, offset, length } as MentionEntity;
          })
          .filter((e): e is MentionEntity => e !== null)
      : [];
  }

  override encodeJSON(): Record<string, unknown> {
    // 只放 content。type / mention / reply 由 SDK 基类 encode() 拼。
    return { content: this.text };
  }

  /**
   * SDK encode() 把 contentObj 序列化为 Uint8Array，但只编 mention.{all,uids}；
   * entities 是 mirror 扩展，需要在 SDK 序列化完成后 patch 进去。
   * 同时把 entities 写回 this.contentObj，方便本地 fresh 渲染。
   */
  override encode(): Uint8Array {
    const bytes = super.encode();
    if (!this.mentionEntities.length) return bytes;
    try {
      const obj = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
      const mention = (obj.mention as Record<string, unknown> | undefined) ?? {};
      mention.entities = this.mentionEntities;
      obj.mention = mention;
      // contentObj 是 SDK 上层 fresh 渲染读的；同步更新避免回声不一致
      if (!this.contentObj) this.contentObj = {};
      const localMention = (this.contentObj.mention as Record<string, unknown> | undefined) ?? {};
      localMention.entities = this.mentionEntities;
      this.contentObj.mention = localMention;
      return new TextEncoder().encode(JSON.stringify(obj));
    } catch {
      return bytes;
    }
  }
}
