import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("filters falsy", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });
});
