import { setupAuthSync } from "./auth-sync";
import { setupHandlers } from "./handlers";
import { setupMenus } from "./menus";
import { setupNotifications } from "./notifications";

export function setupBackground(): void {
  setupAuthSync();
  setupHandlers();
  setupMenus();
  setupNotifications();
}
