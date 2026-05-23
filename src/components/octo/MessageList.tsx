import { Fragment, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { getApiUrl } from "@/api/client";
import { useChannelInfos } from "@/api/queries/channels";
import { useChannelMembers } from "@/api/queries/members";
import type { ChannelInfo } from "@/api/schemas/channel";
import { ChannelType } from "@/const/channel";
import { dedupKey } from "@/im/hooks/useChannelMessages";
import type { MessageView } from "@/im/message";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";
import { resolvePersonAvatar } from "@/utils/avatar";
import { formatDateSeparator } from "@/utils/time";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: MessageView[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

interface MsgMeta {
  /** 同一天的第一条 = 上方渲染日期分隔条 */
  dayLabel?: string;
  /** 同人 60s 内合并：头像/名字省略 */
  grouped: boolean;
  /** 下一条仍是同人续发：用于 grouping 圆角（grp-first / grp-mid 收 BL） */
  groupedWithNext: boolean;
}

/** mirror historyScroll.ts:1：上滑离顶 ≤ 250px 触发 loadMore */
const TOP_TRIGGER_OFFSET = 250;
/** 贴底阈值（mirror Conversation 默认 80px） */
const BOTTOM_TRIGGER_OFFSET = 80;

function dayKeyOf(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildMeta(messages: MessageView[]): Map<string, MsgMeta> {
  const out = new Map<string, MsgMeta>();
  let lastDayKey: string | null = null;
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    if (!m) continue;
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;
    const dayKey = dayKeyOf(m.timestamp);
    const isNewDay = dayKey !== lastDayKey;
    const grouped =
      !isNewDay &&
      prev != null &&
      prev.fromUid === m.fromUid &&
      m.timestamp - prev.timestamp < 60 &&
      !prev.revoked &&
      !m.revoked;
    const nextIsNewDay = next != null && dayKeyOf(next.timestamp) !== dayKey;
    const groupedWithNext =
      next != null &&
      !nextIsNewDay &&
      next.fromUid === m.fromUid &&
      next.timestamp - m.timestamp < 60 &&
      !next.revoked &&
      !m.revoked;
    out.set(dedupKey(m), {
      ...(isNewDay && { dayLabel: formatDateSeparator(new Date(m.timestamp * 1000)) }),
      grouped,
      groupedWithNext,
    });
    if (isNewDay) lastDayKey = dayKey;
  }
  return out;
}

/**
 * 手搓的可滚消息列表（mirror Conversation/index.tsx:1550 + vm.ts:1738/1568 行为对照）：
 * - 普通 `<div>` + `overflow-y-auto`，所有消息一次渲染。
 * - 首屏 + 新消息 append（用户已贴底）：useLayoutEffect 里同步 `scrollTop = scrollHeight`，
 *   commit 之前已经在底部，浏览器从来没机会画"在顶部"那一帧 → 切会话不闪。
 * - prepend 历史：捕获 commit 前的 scrollHeight/scrollTop，commit 后用
 *   `scrollTop = prevTop + (newHeight - prevHeight)` 恢复，用户视野的内容不动。
 * - onScroll：`scrollTop ≤ 250` 触发 loadMore；并发由 useChannelMessages.inflightRef 兜底。
 *
 * 不使用虚拟列表，单频道 < 几千条消息体感最丝滑（mirror 验证过的方案）。
 */
export function MessageList({ messages, hasMore, loadingMore, onLoadMore }: MessageListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // 群成员名 / 头像查表
  const channelId = messages[0]?.channelId ?? null;
  const channelType = messages[0]?.channelType ?? 0;
  const isGroupy = channelType === ChannelType.group || channelType === ChannelType.communityTopic;
  const { data: members } = useChannelMembers({
    channelId: isGroupy ? channelId : null,
    limit: 1000,
  });
  const memberMap = useMemo(() => {
    const m = new Map<string, { name: string; avatar?: string }>();
    for (const mb of members ?? []) {
      m.set(mb.uid, { name: mb.remark || mb.name, ...(mb.avatar && { avatar: mb.avatar }) });
    }
    return m;
  }, [members]);
  const senderUids = useMemo(() => Array.from(new Set(messages.map((m) => m.fromUid))), [messages]);
  const senderInfoItems = useMemo(
    () => senderUids.map((uid) => ({ channelId: uid, channelType: ChannelType.person })),
    [senderUids],
  );
  const senderInfoQueries = useChannelInfos(senderInfoItems);
  const senderInfoByUid = useMemo(() => {
    const m = new Map<string, ChannelInfo>();
    senderUids.forEach((uid, i) => {
      const info = senderInfoQueries[i]?.data;
      if (info) m.set(uid, info);
    });
    return m;
  }, [senderUids, senderInfoQueries]);

  const meta = useMemo(() => buildMeta(messages), [messages]);

  // 头像走 resolvePersonAvatar：channelInfo.logo/avatar → users/{uid}/avatar?v={avatarTag}，
  // 与 octo-web WKAvatar/WKApp.avatarChannel 的私聊、群聊 tab 逻辑保持一致。
  const baseURL = getApiUrl();
  const spaceId = useSpaceStore(selectCurrentSpaceId);

  // 是否贴底：onScroll 里更新；append 新消息时是否自动跟随
  const atBottomRef = useRef(true);

  // 上一次 commit 后捕获的 scroll/dom 快照；下次 commit 用来对比和恢复
  const prevFirstIdRef = useRef<string | null>(null);
  const prevLastIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  // 当前已经在哪个频道；切频道时把上面的锚点清掉，重新走首屏分支
  // 注：必须在同一个 useLayoutEffect 里检测，不能用单独的 useEffect 重置 ——
  // 后者在 paint 后跑，会把 useLayoutEffect 刚填好的锚点清掉，导致下一次
  // prepend 命中"首屏分支"直接弹回最底（这就是"滚到顶就跳到底"的 bug）。
  const currentChannelKeyRef = useRef<string | null>(null);

  // commit 后、paint 前同步处理滚动（关键：useLayoutEffect 而非 useEffect）
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || messages.length === 0) return;

    const firstMsg = messages[0];
    const lastMsg = messages[messages.length - 1];
    if (!firstMsg || !lastMsg) return;

    const channelKey = `${firstMsg.channelId}:${firstMsg.channelType}`;
    if (currentChannelKeyRef.current !== channelKey) {
      // 频道切换（MessageList 复用场景）：清空锚点，下面会走首屏分支
      currentChannelKeyRef.current = channelKey;
      prevFirstIdRef.current = null;
      prevLastIdRef.current = null;
      prevScrollHeightRef.current = 0;
      prevScrollTopRef.current = 0;
      atBottomRef.current = true;
    }

    const firstId = dedupKey(firstMsg);
    const lastId = dedupKey(lastMsg);
    const prevFirst = prevFirstIdRef.current;
    const prevLast = prevLastIdRef.current;

    if (prevFirst === null) {
      // 首屏（或切会话后第一笔）：直接落到底部
      el.scrollTop = el.scrollHeight;
    } else if (firstId !== prevFirst) {
      // prepend 历史：保持视口锚定到原本看到的那条消息
      const delta = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop = prevScrollTopRef.current + delta;
    } else if (lastId !== prevLast && atBottomRef.current) {
      // append 新消息且用户原本贴底：跟到底
      el.scrollTop = el.scrollHeight;
    }
    // 其它情况（消息撤回 / metadata 改）：scrollTop 不动

    prevFirstIdRef.current = firstId;
    prevLastIdRef.current = lastId;
    prevScrollHeightRef.current = el.scrollHeight;
    prevScrollTopRef.current = el.scrollTop;
  }, [messages]);

  // 图片加载完会改变 scrollHeight；首次还在贴底时再校准一次，避免出现"滚到底但底下少一截"
  const handleImageLoad = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    // 持续把当前 scroll 状态同步进 refs —— 这是 prepend 恢复滚动位置的关键。
    // 如果只在 useLayoutEffect 末尾更新这两个 ref，用户手动上滑（不触发 React render）
    // 期间它们就会"卡在上次 commit 的位置"陈旧化；下一次 prepend 拿这俩做
    // `scrollTop = prevTop + (newHeight - prevHeight)`，结果是把用户"按上次 commit 位置 + delta"
    // 弹去新底部。mirror 的 pulldownMessages() 是 await 前现读 scrollTop（vm.ts:1561）
    // 来回避这点，我们没那个时机就持续同步。
    prevScrollTopRef.current = scrollTop;
    prevScrollHeightRef.current = scrollHeight;
    atBottomRef.current = scrollHeight - (scrollTop + clientHeight) <= BOTTOM_TRIGGER_OFFSET;
    if (scrollTop <= TOP_TRIGGER_OFFSET && hasMore && !loadingMore) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-(--color-muted-foreground)">
        还没有消息，发一条试试
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      onLoad={handleImageLoad}
      className="h-full overflow-y-auto overflow-x-hidden"
    >
      {(loadingMore || hasMore) && (
        <div className="py-2 text-center text-[11px] text-(--color-muted-foreground)">
          {loadingMore ? "加载中…" : "上滑加载更早"}
        </div>
      )}
      {messages.map((m) => {
        const k = dedupKey(m);
        const md = meta.get(k);
        const memberInfo = memberMap.get(m.fromUid);
        const channelInfo = senderInfoByUid.get(m.fromUid);
        const displayName =
          memberInfo?.name || channelInfo?.remark?.trim() || channelInfo?.name?.trim();
        const avatarLogo = channelInfo?.logo?.trim() || memberInfo?.avatar?.trim();
        const avatarUrl = resolvePersonAvatar({
          baseURL,
          channelId: m.fromUid,
          spaceId,
          ...(avatarLogo && { logo: avatarLogo }),
        });
        return (
          <Fragment key={k}>
            {md?.dayLabel && (
              <div className="octo-day-sep flex justify-center py-1.5">
                <span className="rounded-full bg-(--color-muted)/50 px-3 py-0.5 text-[11px] text-(--color-muted-foreground)">
                  {md.dayLabel}
                </span>
              </div>
            )}
            <MessageBubble
              message={m}
              groupedWithPrev={md?.grouped ?? false}
              groupedWithNext={md?.groupedWithNext ?? false}
              {...(displayName && { displayName })}
              {...(avatarUrl && { avatarUrl })}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
