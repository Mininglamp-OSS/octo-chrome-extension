import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchChannelHistory } from "@/im/history";
import type { MessageView } from "@/im/message";
import { onImMessage, onImMessageRevoked, onImMessageUpdated } from "@/im/proxy";
import { REASON_TIMEOUT, reasonCodeToMessage } from "@/im/sendError";
import { shouldKeepPersonMessageForSpace } from "@/im/spaceFilter";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";

interface State {
  messages: MessageView[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
}

const PAGE = 30;

/**
 * 自己发的消息 SDK 直接 notifyMessageListeners 推 stub —— messageID=0/messageSeq=0；
 * 真实 id 要等 SendackPacket 通过 imMessageUpdated 回填。所以**稳定 key 必须用 clientMsgNo**：
 * - dedup（避免多条 stub 撞同一个 messageId=0 互相吞掉）
 * - 渲染 key（避免 ack 回填换 messageId 时整条 re-mount）
 * - 反查（imMessageUpdated 按 clientMsgNo 找原 stub patch）
 * 收到别人的消息时 clientMsgNo 也由服务端 RecvPacket 带过来，逻辑统一。
 */
export function dedupKey(m: Pick<MessageView, "clientMsgNo" | "messageId">): string {
  return m.clientMsgNo || m.messageId;
}

/**
 * 拉某个 channel 的消息流。
 *
 * 关键设计：
 * - 历史走 sidepanel 直 HTTP（fetchChannelHistory）—— 走 ky，X-Space-Id 自动来自本进程 spaceStore
 * - 首次拉跟 mirror curl 严格一致：不传 startMessageSeq / pullMode，server 返回"最新一页"
 * - 推送（imMessage / Updated / Revoked）由本进程 SDK listener 直接订阅，进 dedup 后合并
 * - Person/BotFather 跨 space 历史靠 shouldKeepPersonMessageForSpace 二次过滤（mirror
 *   filterPersonMessagesBySpace 等价）
 */
export function useChannelMessages(
  channelId: string | null,
  channelType: number,
): State & { loadMore: () => Promise<void> } {
  const spaceId = useSpaceStore(selectCurrentSpaceId);

  const [state, setState] = useState<State>({
    messages: [],
    loading: false,
    loadingMore: false,
    hasMore: true,
    error: null,
  });
  const seenIds = useRef<Set<string>>(new Set());
  const inflightRef = useRef(false);
  const hasMoreRef = useRef(true);
  const messagesRef = useRef<MessageView[]>([]);
  // stub 的 sendack 超时降级：clientMsgNo → timer id。10s 内若 onImMessageUpdated
  // 没把这条 stub 升级（messageSeq 仍为 0），就把它标 sendFailed=true。
  // 这是为了应对 SDK 在 WS 未连接时 fire-and-forget 静默吞失败的情形。
  const sendTimers = useRef<Map<string, number>>(new Map());
  const SEND_TIMEOUT_MS = 10_000;
  const SEND_TIMEOUT_REASON = REASON_TIMEOUT;
  // 已 toast 过失败的 clientMsgNo，避免同一条消息多次提示（stub 超时 + sendack 也来时只弹一次）
  const toastedFailures = useRef<Set<string>>(new Set());
  const toastSendFailureOnce = useCallback((clientMsgNo: string, reasonCode: number) => {
    if (toastedFailures.current.has(clientMsgNo)) return;
    toastedFailures.current.add(clientMsgNo);
    toast.error(reasonCodeToMessage(reasonCode));
  }, []);

  // 用 useCallback 稳定引用，避免 hook deps 触发不必要的 effect 重订阅
  const clearSendTimer = useCallback((clientMsgNo: string) => {
    const t = sendTimers.current.get(clientMsgNo);
    if (t !== undefined) {
      window.clearTimeout(t);
      sendTimers.current.delete(clientMsgNo);
    }
  }, []);
  const clearAllSendTimers = useCallback(() => {
    for (const t of sendTimers.current.values()) window.clearTimeout(t);
    sendTimers.current.clear();
  }, []);

  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);
  useEffect(() => {
    hasMoreRef.current = state.hasMore;
  }, [state.hasMore]);
  // 组件 unmount 时清掉所有 sendack 超时计时器，防泄漏
  useEffect(() => () => clearAllSendTimers(), [clearAllSendTimers]);

  // 首次拉：跟 mirror 一致，不传 startMessageSeq / pullMode，让 server 返回"最新一页"。
  // 不再依赖 conversation.lastMessageSeq（之前传 lastSeq+Down 会走另一条 server 分支）。
  useEffect(() => {
    if (!channelId) {
      setState({ messages: [], loading: false, loadingMore: false, hasMore: false, error: null });
      inflightRef.current = false;
      hasMoreRef.current = false;
      return;
    }
    let cancelled = false;
    seenIds.current = new Set();
    inflightRef.current = false;
    hasMoreRef.current = true;
    clearAllSendTimers();
    toastedFailures.current.clear();
    setState({ messages: [], loading: true, loadingMore: false, hasMore: true, error: null });

    fetchChannelHistory(channelId, channelType, { limit: PAGE })
      .then((batch) => {
        if (cancelled) return;
        // 不做 channelId 过滤：1v1 Person 频道双向消息 channel_id 字段不同
        // （bot 回复的消息 channel_id=自己 uid，自己发的消息 channel_id=对端 uid），
        // mirror 历史路径也信任 server 返回，只按 space_id 二次隔离 BotFather 跨 space。
        const filtered = batch.filter((m) => shouldKeepPersonMessageForSpace(m, spaceId));
        const dedup = filtered.filter((m) => !seenIds.current.has(dedupKey(m)));
        for (const m of dedup) seenIds.current.add(dedupKey(m));
        const sorted = dedup.sort((a, b) => a.messageSeq - b.messageSeq);
        const reachedTop =
          batch.length === 0 || batch.length < PAGE || batch.some((m) => m.messageSeq === 1);
        hasMoreRef.current = !reachedTop;
        setState({
          messages: sorted,
          loading: false,
          loadingMore: false,
          hasMore: !reachedTop,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          messages: [],
          loading: false,
          loadingMore: false,
          hasMore: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [channelId, channelType, spaceId, clearAllSendTimers]);

  // 实时收消息
  useEffect(() => {
    if (!channelId) return;
    return onImMessage((m) => {
      if (m.channelId !== channelId || m.channelType !== channelType) return;
      if (!shouldKeepPersonMessageForSpace(m, spaceId)) return;
      const k = dedupKey(m);
      if (seenIds.current.has(k)) return;
      seenIds.current.add(k);
      // 自己发的 stub（messageSeq===0）开一个 sendack 超时计时器；
      // onImMessageUpdated 会 clearTimer。超时则标 sendFailed=true。
      if (m.messageSeq === 0 && m.clientMsgNo) {
        const cmsg = m.clientMsgNo;
        const timer = window.setTimeout(() => {
          sendTimers.current.delete(cmsg);
          setState((prev) => {
            let touched = false;
            const next = prev.messages.map((x) => {
              if (x.clientMsgNo !== cmsg) return x;
              if (x.messageSeq !== 0) return x; // 已被 sendack 升级
              if (x.sendFailed) return x;
              touched = true;
              return { ...x, sendFailed: true, reasonCode: SEND_TIMEOUT_REASON };
            });
            return touched ? { ...prev, messages: next } : prev;
          });
          toastSendFailureOnce(cmsg, SEND_TIMEOUT_REASON);
        }, SEND_TIMEOUT_MS);
        sendTimers.current.set(cmsg, timer);
      }
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, m].sort((a, b) => a.messageSeq - b.messageSeq),
      }));
    });
  }, [channelId, channelType, spaceId, toastSendFailureOnce]);

  // sendack 回填：按 clientMsgNo 找到 stub，把 messageId/messageSeq 替换成真实值。
  useEffect(() => {
    if (!channelId) return;
    return onImMessageUpdated((ev) => {
      if (ev.channelId !== channelId || ev.channelType !== channelType) return;
      if (ev.clientMsgNo) clearSendTimer(ev.clientMsgNo);
      setState((prev) => {
        let touched = false;
        const next = prev.messages.map((m) => {
          if (m.clientMsgNo !== ev.clientMsgNo) return m;
          touched = true;
          // WuKongIM ReasonCode: 0=unknown, 1=success, 2+=各种失败
          // （见 wukongimjssdk.esm.js ReasonCode 枚举）
          if (ev.reasonCode !== 1) {
            return { ...m, sendFailed: true, reasonCode: ev.reasonCode };
          }
          return {
            ...m,
            messageId: ev.messageId,
            messageSeq: ev.messageSeq,
            sendFailed: false,
          };
        });
        if (!touched) return prev;
        if (ev.reasonCode === 1 && ev.messageId) seenIds.current.add(ev.messageId);
        return { ...prev, messages: next };
      });
      // 服务端业务失败（被禁言/拉黑/不存在等）也 toast 一次具体原因
      if (ev.reasonCode !== 1 && ev.clientMsgNo) {
        toastSendFailureOnce(ev.clientMsgNo, ev.reasonCode);
      }
    });
  }, [channelId, channelType, clearSendTimer, toastSendFailureOnce]);

  // 撤回
  useEffect(() => {
    if (!channelId) return;
    return onImMessageRevoked((ev) => {
      if (ev.channelId !== channelId || ev.channelType !== channelType) return;
      setState((prev) => {
        let touched = false;
        const next = prev.messages.map((m) => {
          if (m.messageId !== ev.messageId) return m;
          if (m.revoked) return m;
          touched = true;
          return { ...m, revoked: true, revoker: ev.revoker };
        });
        return touched ? { ...prev, messages: next } : prev;
      });
    });
  }, [channelId, channelType]);

  const loadMore = useCallback(async () => {
    if (!channelId) return;
    if (inflightRef.current) return;
    if (!hasMoreRef.current) return;
    const head = messagesRef.current[0];
    if (!head) return;
    inflightRef.current = true;
    setState((prev) => ({ ...prev, loadingMore: true }));

    try {
      const batch = await Promise.race([
        fetchChannelHistory(channelId, channelType, {
          startMessageSeq: Math.max(0, head.messageSeq - 1),
          endMessageSeq: 0,
          limit: PAGE,
          pullMode: 0,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("loadMore timeout (10s)")), 10_000),
        ),
      ]);
      // loadMore 同首次拉：不做 channelId 过滤，只按 space 隔离
      const filtered = batch.filter((m) => shouldKeepPersonMessageForSpace(m, spaceId));
      const dedup = filtered.filter((m) => !seenIds.current.has(dedupKey(m)));
      for (const m of dedup) seenIds.current.add(dedupKey(m));
      const reachedTop =
        batch.length === 0 || batch.length < PAGE || batch.some((m) => m.messageSeq === 1);
      hasMoreRef.current = !reachedTop;
      setState((prev) => ({
        ...prev,
        messages: [...dedup, ...prev.messages].sort((a, b) => a.messageSeq - b.messageSeq),
        loadingMore: false,
        hasMore: !reachedTop,
      }));
    } catch (err: unknown) {
      console.error("[octo:loadMore] FAILED", {
        channelId,
        err: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      });
      setState((prev) => ({
        ...prev,
        loadingMore: false,
        error: err instanceof Error ? err : new Error(String(err)),
      }));
    } finally {
      inflightRef.current = false;
    }
  }, [channelId, channelType, spaceId]);

  return { ...state, loadMore };
}
