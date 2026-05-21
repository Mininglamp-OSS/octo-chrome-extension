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
  const tag = cacheTag ?? "1";

  if (channelType === ChannelType.person) {
    let uid = channelId;
    // 优先按当前 spaceId 精确剥；不匹配时再用通用正则兜底（IM 实测：当 currentSpaceId
    // 为 null，channelId 仍可能带 sXXX_ 前缀）
    if (spaceId && uid.startsWith(`s${spaceId}_`)) {
      uid = uid.slice(`s${spaceId}_`.length);
    } else if (SPACE_PREFIX_RE.test(uid)) {
      uid = uid.replace(SPACE_PREFIX_RE, "");
    }
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
