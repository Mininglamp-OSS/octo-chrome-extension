export type ImSlotClaim = {
  id: string;
  owner: "cmdk";
  expiresAt: number;
};

export const CMDK_IM_SLOT_TTL_MS = 60_000;
export const CMDK_IM_SLOT_REFRESH_MS = 20_000;

export function createCmdkImSlotClaim(id: string, now = Date.now()): ImSlotClaim {
  return { id, owner: "cmdk", expiresAt: now + CMDK_IM_SLOT_TTL_MS };
}

export function isActiveImSlotClaim(
  claim: ImSlotClaim | null | undefined,
  now = Date.now(),
): boolean {
  return !!claim && claim.expiresAt > now;
}

/**
 * 单 owner 仲裁：新 claim 是否应被授予。
 *
 * 仅当已存在「他人的、未过期的」claim 时拒绝——防两个 cmdk 实例（多 tab）都抢到
 * 槽位、都连 deviceFlag=2 互踢。无 claim / 已过期 / 同 id 续期 → 授予。
 */
export function shouldGrantClaim(
  current: ImSlotClaim | null | undefined,
  next: ImSlotClaim,
  now = Date.now(),
): boolean {
  if (!current) return true;
  if (current.id === next.id) return true;
  return !isActiveImSlotClaim(current, now);
}
