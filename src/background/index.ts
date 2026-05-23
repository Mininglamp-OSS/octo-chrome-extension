import { setupAuthSync } from "./auth-sync";
import { setupHandlers } from "./handlers";
import { setupSso } from "./sso";

export function setupBackground(): void {
  setupAuthSync();
  setupHandlers();
  setupSso();
}
