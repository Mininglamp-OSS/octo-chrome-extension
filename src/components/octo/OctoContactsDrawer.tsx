import { useEffect, useMemo, useRef, useState } from "react";
import { getApiUrl } from "@/api/client";
import { useMyBots } from "@/api/queries/contacts";
import { useSpaceMembers } from "@/api/queries/spaces";
import type { SpaceMember } from "@/api/schemas/space";
import { ChannelType } from "@/const/channel";
import { useBotAvatarMap } from "@/hooks/useBotAvatarMap";
import { useAuthStore } from "@/stores/auth";
import { useCurrentChannel } from "@/stores/currentChannel";
import { useDrawerStore } from "@/stores/drawer";
import { useSpaceStore } from "@/stores/space";
import { avatarGradient, channelAvatarUrl, getFirstChar } from "@/utils/avatar";

/**
 * 通讯录抽屉。布局/类名对照 mirror 插件端 OctoContactsDrawer：
 * - .octo-contacts-drawer 绝对定位覆盖在主区，左滑入；is-open 控显隐
 * - .cd-head / .cd-search / .cd-body / .cd-section / .cd-row / .cd-av / .cd-txt / .cd-nm
 * - AI 伙伴走 my_bots，朋友走 space/{id}/members（过滤掉自己 + robot===1）
 * - 关闭时丢弃 spaceId 缓存，下次打开重拉，避免空间切换后看到旧数据
 */
export function OctoContactsDrawer() {
  const open = useDrawerStore((s) => s.contacts);
  const close = useDrawerStore((s) => s.closeContacts);
  const select = useCurrentChannel((s) => s.select);
  const myUid = useAuthStore((s) => s.state?.uid ?? "");
  const spaceId = useSpaceStore((s) => s.currentSpaceId);

  const [keyword, setKeyword] = useState("");

  // 「真正驱动 query 的 spaceId」：抽屉打开时才赋值；关闭后回退 null 让 query 跳过/弃用
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  // 防止打开期间 currentSpaceId 切换 → 顺势更新触发新 query
  useEffect(() => {
    if (!open) {
      setActiveSpaceId(null);
      setKeyword("");
      return;
    }
    if (spaceId && spaceId !== activeSpaceId) {
      setActiveSpaceId(spaceId);
    }
  }, [open, spaceId, activeSpaceId]);

  const membersQ = useSpaceMembers(activeSpaceId, { enabled: open });
  const botsQ = useMyBots();
  const loaded = membersQ.isSuccess && botsQ.isSuccess;

  const aiPartners: SpaceMember[] = useMemo(() => {
    const list = botsQ.data ?? [];
    return list.map((b) => ({
      uid: b.uid,
      name: b.name || b.uid,
      avatar: b.avatar ?? "",
      role: 3,
      robot: 1,
      created_at: "",
    }));
  }, [botsQ.data]);

  const friends: SpaceMember[] = useMemo(() => {
    const list = membersQ.data ?? [];
    return list.filter((m) => m.uid !== myUid && m.robot !== 1);
  }, [membersQ.data, myUid]);

  // 真头像：朋友 = users/{uid}/avatar；AI 伙伴 = person channelInfo.logo
  const botAvatarMap = useBotAvatarMap(aiPartners);
  const baseURL = getApiUrl();

  const kw = keyword.trim().toLowerCase();
  const filteredAi = useMemo(
    () => (kw ? aiPartners.filter((m) => m.name.toLowerCase().includes(kw)) : aiPartners),
    [aiPartners, kw],
  );
  const filteredFriends = useMemo(
    () => (kw ? friends.filter((m) => m.name.toLowerCase().includes(kw)) : friends),
    [friends, kw],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function onPick(uid: string): void {
    close();
    select(uid, ChannelType.person);
  }

  return (
    <>
      {/* rail 区 dim 遮罩：仅覆盖右侧 48px，点击关闭 */}
      <button
        type="button"
        className={`octo-contacts-backdrop${open ? " is-open" : ""}`}
        onClick={close}
        aria-label="关闭通讯录"
        tabIndex={open ? 0 : -1}
      />
      <div className={`octo-contacts-drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
        <div className="cd-head">
          <button type="button" className="cd-back" onClick={close} title="返回">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="cd-title">通讯录</div>
          <button type="button" className="cd-textbtn" onClick={close}>
            关闭
          </button>
        </div>

        <div className="cd-search">
          <div className="cd-input">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="搜索朋友、AI 伙伴…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>

        <div className="cd-body">
          {!loaded && <div className="cd-section">加载中…</div>}

          {filteredAi.length > 0 && (
            <>
              <div className="cd-section">AI 伙伴 · {filteredAi.length}</div>
              {filteredAi.map((m) => (
                <Row
                  key={m.uid}
                  member={m}
                  ai
                  avatarUrl={botAvatarMap.get(m.uid)}
                  onClick={() => onPick(m.uid)}
                />
              ))}
            </>
          )}

          {filteredFriends.length > 0 && (
            <>
              <div className="cd-section">我的朋友 · {filteredFriends.length}</div>
              {filteredFriends.map((m) => (
                <Row
                  key={m.uid}
                  member={m}
                  avatarUrl={channelAvatarUrl(baseURL, m.uid, ChannelType.person)}
                  onClick={() => onPick(m.uid)}
                />
              ))}
            </>
          )}

          {loaded && filteredAi.length === 0 && filteredFriends.length === 0 && (
            <div className="cd-empty">
              <span className="cd-empty-icon" aria-hidden="true">
                👤
              </span>
              <span>{keyword ? "无匹配" : "暂无联系人"}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Row({
  member,
  ai,
  avatarUrl,
  onClick,
}: {
  member: SpaceMember;
  ai?: boolean;
  avatarUrl?: string;
  onClick: () => void;
}) {
  const initials = getFirstChar(member.name);
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(avatarUrl) && !imgFailed;
  return (
    <button type="button" className="cd-row" onClick={onClick}>
      <div
        className={ai ? "cd-av ai" : "cd-av"}
        style={ai || showImg ? undefined : { background: avatarGradient(member.name) }}
      >
        {showImg ? (
          <img
            src={avatarUrl}
            alt={member.name}
            className="h-full w-full rounded-[inherit] object-cover"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        ) : (
          initials
        )}
      </div>
      <div className="cd-txt">
        <span className="cd-nm">
          {member.name}
          {ai && <span className="cd-badge-ai">Agent</span>}
        </span>
      </div>
      {!ai && (
        <span className="cd-chev" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      )}
    </button>
  );
}
