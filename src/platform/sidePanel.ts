import { browser } from "wxt/browser";

interface SidePanelLikeApi {
  open?: (info: { windowId: number; tabId?: number }) => Promise<void>;
  setOptions?: (opts: { path: string; enabled?: boolean; tabId?: number }) => Promise<void>;
}

function api(): SidePanelLikeApi | undefined {
  return (browser as unknown as { sidePanel?: SidePanelLikeApi }).sidePanel;
}

export async function openSidePanel(windowId?: number): Promise<void> {
  const sp = api();
  if (!sp?.open) return;
  if (windowId != null) {
    await sp.open({ windowId });
  } else {
    const win = await browser.windows.getCurrent();
    if (win.id != null) await sp.open({ windowId: win.id });
  }
}

export async function setSidePanelPath(path: string): Promise<void> {
  const sp = api();
  if (!sp?.setOptions) return;
  await sp.setOptions({ path, enabled: true });
}
