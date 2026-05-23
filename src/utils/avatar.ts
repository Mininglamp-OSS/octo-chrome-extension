import { storage } from "wxt/utils/storage";
import { ChannelType } from "@/const/channel";

export function getFirstChar(name: string): string {
  if (!name) return "?";
  let ch: string;
  const Seg = (Intl as unknown as { Segmenter?: new (...args: unknown[]) => Intl.Segmenter })
    .Segmenter;
  if (typeof Seg === "function") {
    const segmenter = new Seg(undefined, { granularity: "grapheme" });
    const first = segmenter.segment(name)[Symbol.iterator]().next();
    ch = first.done ? "" : first.value.segment;
  } else {
    ch = Array.from(name)[0] ?? "";
  }
  if (!ch) return "?";
  if (/^[a-zA-Z0-9]$/.test(ch)) return ch.toUpperCase();
  return ch;
}

/**
 * Rail / 头像 fallback 文字：
 *  - 「Product Review」→ PR（含空白的 ASCII 走词首缩写）
 *  - 「alice」→ AL（纯 ASCII 单词大写化前 2 字母）
 *  - 「都市青年」→ 都市（中文/混合按 grapheme 取前 2）
 *  - 「👋hi」→ 👋（emoji 一个就够，多于 1 个 grapheme 时若首是 emoji 单独返回避免视觉杂）
 *  避免「都」「都」「都」级别的撞首字。
 */
export function getInitials(name: string, max = 2): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";

  // 1) 全 ASCII 且含空白 → 词首字母缩写
  if (/^[\x20-\x7e]+$/.test(trimmed) && /\s/.test(trimmed)) {
    const initials = trimmed
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, max)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
    if (initials) return initials;
  }

  // 2) 按 grapheme 取前 max 个
  const Seg = (Intl as unknown as { Segmenter?: new (...args: unknown[]) => Intl.Segmenter })
    .Segmenter;
  const chars: string[] = [];
  if (typeof Seg === "function") {
    const segmenter = new Seg(undefined, { granularity: "grapheme" });
    for (const seg of segmenter.segment(trimmed)) {
      chars.push(seg.segment);
      if (chars.length >= max) break;
    }
  } else {
    for (const c of trimmed) {
      chars.push(c);
      if (chars.length >= max) break;
    }
  }
  if (chars.length === 0) return "?";

  // 3) 首字符是 emoji/特殊符号则只取首字（视觉避免「👋h」奇怪组合）
  const first = chars[0] ?? "";
  if (!/^[\p{L}\p{N}]/u.test(first)) return first;

  const out = chars.join("");
  if (/^[a-zA-Z0-9]+$/.test(out)) return out.toUpperCase();
  return out;
}

export function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1},65%,55%), hsl(${h2},65%,45%))`;
}

/** thread channelId 形如 `t{groupNo}_{topicId}`，提取父群 groupNo */
function parseThreadParentGroup(channelId: string): string | null {
  if (!channelId.startsWith("t")) return null;
  const rest = channelId.slice(1);
  const idx = rest.indexOf("_");
  if (idx <= 0) return null;
  return rest.slice(0, idx);
}

/** mirror commonDataSource.getImageURL 等价：相对路径 prepend baseURL；data:/http(s)://直通 */
export function resolveImageURL(baseURL: string, path: string): string {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (!baseURL) return path;
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `${baseURL}${trimmed}`;
}

/** IM 层经常把私聊 channelId 包成 `s{spaceId}_{uid}`，剥前缀拿真实 uid。 */
const SPACE_PREFIX_RE = /^s[0-9A-Za-z]+_/;

/** 把 person 私聊 channelId 还原成真实 uid（剥 `s{spaceId}_` 前缀）。 */
export function stripSpacePrefix(channelId: string, spaceId?: string | null): string {
  let uid = channelId;
  if (spaceId && uid.startsWith(`s${spaceId}_`)) {
    uid = uid.slice(`s${spaceId}_`.length);
  } else if (SPACE_PREFIX_RE.test(uid)) {
    uid = uid.replace(SPACE_PREFIX_RE, "");
  }
  return uid;
}

const avatarTags = new Map<string, string>();

/**
 * Tags 持久化到 wxt storage，跨刷新保留。
 * - 浏览器 HTTP cache key = URL（含 ?v=tag），tag 稳定 → 刷新后整盘头像直接 from disk cache
 * - 跨 entrypoint：sidepanel / cmdk 各自 hydrate 同一份 storage，tag 一致 → 浏览器 cache 共享
 *
 * 写入用 dirty + 500ms debounce flush，避免短时间内高频拼 URL 触发同步 IO。
 */
const TAGS_STORAGE_KEY = "local:octo:avatar-tags" as const;
let _tagsItem: ReturnType<
  typeof storage.defineItem<Record<string, string>>
> | null = null;
let tagsDirty = false;
let tagsFlushTimer: ReturnType<typeof setTimeout> | null = null;

/** test / SSR 环境 chrome.runtime 缺席时禁用 storage，避免 unhandled rejection。 */
function isStorageAvailable(): boolean {
  return typeof chrome !== "undefined" && typeof chrome.runtime?.id === "string";
}

/** 延迟创建 storage item：模块顶层创建会触发异步 getItem，在 node test 环境下抛错。 */
function tagsItem() {
  if (!_tagsItem) {
    _tagsItem = storage.defineItem<Record<string, string>>(TAGS_STORAGE_KEY, { fallback: {} });
  }
  return _tagsItem;
}

function scheduleTagsFlush(): void {
  if (tagsFlushTimer != null) return;
  if (!isStorageAvailable()) return;
  tagsFlushTimer = setTimeout(() => {
    tagsFlushTimer = null;
    if (!tagsDirty) return;
    tagsDirty = false;
    const obj: Record<string, string> = {};
    for (const [k, v] of avatarTags) obj[k] = v;
    void tagsItem().setValue(obj).catch(() => {});
  }, 500);
}

/** AppBoot 启动时调用一次，把持久化的 tags 灌进内存 Map。 */
export async function hydrateAvatarTags(): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    const obj = await tagsItem().getValue();
    if (!obj) return;
    for (const [k, v] of Object.entries(obj)) {
      // 不覆盖运行中已生成的（避免新写入被旧值挤掉）
      if (!avatarTags.has(k)) avatarTags.set(k, v);
    }
  } catch {
    // ignore
  }
}

/** 订阅其他 entrypoint 改 tag 的通知，本地 Map 实时同步。 */
export function subscribeAvatarTags(): () => void {
  if (!isStorageAvailable()) return () => {};
  try {
    return tagsItem().watch((next) => {
      if (!next) return;
      // 直接 replace：以最新 storage 为准（已包含本端写入，因为本端写后 storage 会广播回来）
      avatarTags.clear();
      for (const [k, v] of Object.entries(next)) avatarTags.set(k, v);
    });
  } catch {
    return () => {};
  }
}

function getDefaultAvatarTag(channelId: string, channelType: number): string {
  const key = `${channelType}:${channelId}`;
  const existing = avatarTags.get(key);
  if (existing) return existing;
  const tag = Date.now().toString();
  avatarTags.set(key, tag);
  tagsDirty = true;
  scheduleTagsFlush();
  return tag;
}

/** 主动 invalidate 一个头像 tag（用户改了头像、上传新 logo 时调）。 */
export function bumpAvatarTag(channelId: string, channelType: number): void {
  const key = `${channelType}:${channelId}`;
  avatarTags.set(key, Date.now().toString());
  tagsDirty = true;
  scheduleTagsFlush();
}

/**
 * mirror App.avatarChannel 等价：按 channel 类型拼后端约定的头像 URL。
 * - person: `{api}users/{uid}/avatar`；channelId 形如 `s{spaceId}_{uid}` 时剥前缀
 * - group: `{api}groups/{groupNo}/avatar`
 * - communityTopic (子区): 走父群头像
 *
 * baseURL 必须以 `/` 结尾。加 v= cache buster 让头像刷新；
 * 如果 channelInfo.logo 有值，调用方应优先用 logo。
 */
export function channelAvatarUrl(
  baseURL: string,
  channelId: string,
  channelType: number,
  spaceId?: string | null,
  cacheTag?: string,
): string {
  if (!channelId || !baseURL) return "";
  const tag = cacheTag ?? getDefaultAvatarTag(channelId, channelType);

  if (channelType === ChannelType.person || channelType === ChannelType.customerService) {
    const uid = stripSpacePrefix(channelId, spaceId);
    return `${baseURL}users/${uid}/avatar?v=${tag}`;
  }
  if (channelType === ChannelType.group) {
    return `${baseURL}groups/${channelId}/avatar?v=${tag}`;
  }
  if (channelType === ChannelType.communityTopic) {
    const parent = parseThreadParentGroup(channelId);
    if (parent) return `${baseURL}groups/${parent}/avatar?v=${tag}`;
  }
  return "";
}

/**
 * person 头像 src 解析（统一入口），对齐 octo-web `WKApp.avatarChannel`：
 *  1. channelInfo.logo/avatar —— 先信任频道信息；强制加 `?v={tag}` cache buster，
 *     避免浏览器把首次 404 缓存住导致一直显首字 fallback
 *  2. channelAvatarUrl(person) —— 兜底 `users/{uid}/avatar?v={tag}`
 */
export function resolvePersonAvatar(opts: {
  baseURL: string;
  channelId: string;
  spaceId?: string | null;
  logo?: string;
  cacheTag?: string;
}): string {
  const { baseURL, channelId, spaceId, logo, cacheTag } = opts;
  if (!channelId || !baseURL) return "";
  const tag = cacheTag ?? getDefaultAvatarTag(channelId, ChannelType.person);

  const fromLogo = logo?.trim();
  if (fromLogo) {
    // mirror App.avatarChannel 等价：logo 已带 `?` 用 `&v=`，否则 `?v=`
    const sep = fromLogo.includes("?") ? "&" : "?";
    return resolveImageURL(baseURL, `${fromLogo}${sep}v=${tag}`);
  }

  return channelAvatarUrl(baseURL, channelId, ChannelType.person, spaceId, tag);
}
