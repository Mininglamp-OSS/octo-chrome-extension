export const TITLE_COLORS = [
  "#8C8DFF",
  "#7983C2",
  "#6D8DDE",
  "#5979F0",
  "#6695DF",
  "#8F7AC5",
  "#9D77A5",
  "#8A64D0",
  "#AA66C3",
  "#A75C96",
  "#C8697D",
  "#B74D62",
  "#BD637C",
  "#B3798E",
  "#9B6D77",
  "#B87F7F",
  "#C5595A",
  "#AA4848",
  "#B0665E",
  "#B76753",
  "#BB5334",
  "#C97B46",
  "#BE6C2C",
  "#CB7F40",
  "#A47758",
  "#B69370",
  "#A49373",
  "#AA8A46",
  "#AA8220",
  "#76A048",
  "#9CAD23",
  "#A19431",
  "#AA9100",
  "#A09555",
  "#C49B4B",
  "#5FB05F",
  "#6AB48F",
  "#71B15C",
  "#B3B357",
  "#A3B561",
  "#909F45",
  "#93B289",
  "#3D98D0",
  "#429AB6",
  "#4EABAA",
  "#6BC0CE",
  "#64B5D9",
  "#3E9CCB",
  "#2887C4",
  "#52A98B",
] as const;

function hashCode(str: string): number {
  // FNV-1a 变体 + 位置加权（i+1）：让靠后字符权重更大，
  // 避免「都市青年/都江堰群」首字相同 → hash 路径前几位一致 → 撞色。
  // 同时混入字符串长度做初值，进一步分散同首字相同长度但内容不同的输入。
  let hash = (str.length * 2654435761) >>> 0; // golden ratio mix
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash ^ (str.charCodeAt(i) * (i + 1))) >>> 0;
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

export function getTitleColor(title = ""): string {
  const n = TITLE_COLORS.length;
  const idx = ((hashCode(title) % n) + n) % n;
  // biome-ignore lint/style/noNonNullAssertion: idx ∈ [0, n) by construction
  return TITLE_COLORS[idx]!;
}

/** 子区右下角 # 角标专用色板：从 TITLE_COLORS 挑 6 色 + 显式避开 mention 橙 #F97316，
 *  保证角标在亮/暗主题下都有足够对比度，且同群多个子区角标颜色互不相同的概率高。 */
const THREAD_HUE_COLORS = [
  "#7C5CFC", // 紫（主色系）
  "#5979F0", // 蓝
  "#5FB05F", // 绿
  "#3E9CCB", // 青
  "#C8697D", // 粉
  "#C49B4B", // 金
] as const;

export function getThreadHueColor(name = ""): string {
  const n = THREAD_HUE_COLORS.length;
  const idx = ((hashCode(name) % n) + n) % n;
  // biome-ignore lint/style/noNonNullAssertion: idx ∈ [0, n) by construction
  return THREAD_HUE_COLORS[idx]!;
}
