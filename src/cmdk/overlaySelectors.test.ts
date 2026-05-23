import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isInsidePortal, PORTAL_SELECTORS } from "./overlaySelectors";

describe("isInsidePortal", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("非 Element / null → false", () => {
    expect(isInsidePortal(null)).toBe(false);
    expect(isInsidePortal({} as EventTarget)).toBe(false);
  });

  it("普通 DOM → false", () => {
    const span = document.createElement("span");
    root.appendChild(span);
    expect(isInsidePortal(span)).toBe(false);
  });

  it("命中 [data-tippy-root]", () => {
    root.setAttribute("data-tippy-root", "");
    const inner = document.createElement("p");
    root.appendChild(inner);
    expect(isInsidePortal(inner)).toBe(true);
  });

  it("命中 Radix popper wrapper", () => {
    root.setAttribute("data-radix-popper-content-wrapper", "");
    expect(isInsidePortal(root)).toBe(true);
  });

  it("命中 octo-mention-popup", () => {
    root.setAttribute("data-octo-mention-popup", "");
    const child = document.createElement("li");
    root.appendChild(child);
    expect(isInsidePortal(child)).toBe(true);
  });

  it("PORTAL_SELECTORS 至少覆盖常见弹层", () => {
    expect(PORTAL_SELECTORS).toContain(".tippy-box");
    expect(PORTAL_SELECTORS).toContain("[data-radix-popper-content-wrapper]");
  });
});
