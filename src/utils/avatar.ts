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

function getDefaultAvatarTag(channelId: string, channelType: number): string {
  const key = `${channelType}:${channelId}`;
  const existing = avatarTags.get(key);
  if (existing) return existing;
  const tag = Date.now().toString();
  avatarTags.set(key, tag);
  return tag;
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
