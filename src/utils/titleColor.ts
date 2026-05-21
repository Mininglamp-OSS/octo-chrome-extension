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
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = hash * 31 + str.charCodeAt(i);
  }
  return hash;
}

export function getTitleColor(title = ""): string {
  const n = TITLE_COLORS.length;
  const idx = ((hashCode(title) % n) + n) % n;
  // biome-ignore lint/style/noNonNullAssertion: idx ∈ [0, n) by construction
  return TITLE_COLORS[idx]!;
}
