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
