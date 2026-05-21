import { setupBackground } from "@/background";

export default defineBackground(() => {
  console.info("[octo:bg] booted", { id: browser.runtime.id });
  setupBackground();
});
