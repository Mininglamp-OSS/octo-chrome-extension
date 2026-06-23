import { describe, expect, it } from "vitest";
import {
  CMDK_IM_SLOT_TTL_MS,
  createCmdkImSlotClaim,
  isActiveImSlotClaim,
} from "./slot";

describe("im slot claim", () => {
  it("treats cmdk claim as active until it expires", () => {
    const now = 1_000;
    const claim = createCmdkImSlotClaim("cmdk-1", now);

    expect(claim).toEqual({
      id: "cmdk-1",
      owner: "cmdk",
      expiresAt: now + CMDK_IM_SLOT_TTL_MS,
    });
    expect(isActiveImSlotClaim(claim, claim.expiresAt - 1)).toBe(true);
    expect(isActiveImSlotClaim(claim, claim.expiresAt)).toBe(false);
    expect(isActiveImSlotClaim(null, now)).toBe(false);
  });
});
