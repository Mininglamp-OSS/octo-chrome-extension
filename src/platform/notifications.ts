import { browser } from "wxt/browser";

export interface NotifyOptions {
  id?: string;
  title: string;
  message: string;
  iconUrl?: string;
  /** 是否要求用户主动关闭 */
  requireInteraction?: boolean;
}

export async function notify(opts: NotifyOptions): Promise<string> {
  const id = opts.id ?? `octo-notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const createOpts = {
    type: "basic" as const,
    title: opts.title,
    message: opts.message,
    iconUrl: opts.iconUrl ?? browser.runtime.getURL("/icon/128.png"),
    ...(opts.requireInteraction != null && { requireInteraction: opts.requireInteraction }),
  };
  // chrome.notifications.NotificationOptions 在不同 @types 版本里要求严格度不同 —— 用 unknown cast
  await (
    browser.notifications.create as unknown as (
      id: string,
      options: typeof createOpts,
    ) => Promise<string>
  )(id, createOpts);
  return id;
}

export async function clearNotification(id: string): Promise<void> {
  await browser.notifications.clear(id);
}

export async function clearAllNotifications(): Promise<void> {
  const all = await browser.notifications.getAll();
  await Promise.all(Object.keys(all).map((id) => browser.notifications.clear(id)));
}
