import { browser } from "wxt/browser";

type ContextType =
  | "all"
  | "page"
  | "frame"
  | "selection"
  | "link"
  | "editable"
  | "image"
  | "video"
  | "audio"
  | "launcher"
  | "browser_action"
  | "page_action"
  | "action";

export interface MenuSpec {
  id: string;
  title: string;
  contexts?: ContextType[];
  parentId?: string;
  type?: "normal" | "checkbox" | "radio" | "separator";
  checked?: boolean;
}

export async function createMenu(spec: MenuSpec): Promise<void> {
  await new Promise<void>((resolve) => {
    const opts: Record<string, unknown> = {
      id: spec.id,
      title: spec.title,
      contexts: (spec.contexts ?? ["action"]) as unknown as readonly ContextType[],
    };
    if (spec.parentId != null) opts["parentId"] = spec.parentId;
    if (spec.type != null) opts["type"] = spec.type;
    if (spec.checked != null) opts["checked"] = spec.checked;
    (
      browser.contextMenus as unknown as {
        create: (o: unknown, cb?: () => void) => void;
      }
    ).create(opts, () => resolve());
  });
}

export async function removeAllMenus(): Promise<void> {
  await browser.contextMenus.removeAll();
}

export function onMenuClicked(handler: (id: string, tabId?: number) => void): () => void {
  const listener = (info: { menuItemId: string | number }, tab?: { id?: number }) => {
    handler(String(info.menuItemId), tab?.id);
  };
  const evt = browser.contextMenus.onClicked as unknown as {
    addListener: (l: (info: unknown, tab?: unknown) => void) => void;
    removeListener: (l: (info: unknown, tab?: unknown) => void) => void;
  };
  evt.addListener(listener as (info: unknown, tab?: unknown) => void);
  return () => evt.removeListener(listener as (info: unknown, tab?: unknown) => void);
}
