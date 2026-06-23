import { describe, expect, it } from "vitest";
import {
  CMDK_IM_SLOT_TTL_MS,
  createCmdkImSlotClaim,
  isActiveImSlotClaim,
  shouldGrantClaim,
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

describe("shouldGrantClaim (single-owner arbitration)", () => {
  const now = 1_000;
  const next = createCmdkImSlotClaim("cmdk-B", now);

  it("grants when no current claim", () => {
    expect(shouldGrantClaim(null, next, now)).toBe(true);
    expect(shouldGrantClaim(undefined, next, now)).toBe(true);
  });

  it("grants renewal by the same owner id even while active", () => {
    const current = createCmdkImSlotClaim("cmdk-B", now);
    expect(shouldGrantClaim(current, next, now)).toBe(true);
  });

  it("rejects when another owner holds an active claim", () => {
    const current = createCmdkImSlotClaim("cmdk-A", now);
    expect(shouldGrantClaim(current, next, now + 1)).toBe(false);
  });

  it("grants when the other owner's claim has expired", () => {
    const current = createCmdkImSlotClaim("cmdk-A", now);
    expect(shouldGrantClaim(current, next, current.expiresAt)).toBe(true);
    expect(shouldGrantClaim(current, next, current.expiresAt + 1)).toBe(true);
  });
});
