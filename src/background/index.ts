import { setupAuthSync } from "./auth-sync";
import { setupBadge } from "./badge";
import { setupHandlers } from "./handlers";
import { setupNotifications } from "./notifications";
import { setupOffscreen } from "./offscreen";
import { setupSso } from "./sso";

export function setupBackground(): void {
  setupAuthSync();
  setupHandlers();
  setupSso();
  setupOffscreen();
  setupBadge();
  setupNotifications();
}
