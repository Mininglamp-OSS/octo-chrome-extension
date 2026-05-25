import { onMessage } from "@/platform/messaging";
import { atMeCountsStorage } from "@/platform/storage";

/**
 * @我 计数 background 端：
 *  - offscreen 或 sidepanel 检测到 mention 自己 → atMeBump → 累加到 storage
 *  - sidepanel 进入对应会话 → atMeClear → 删 storage key
 *
 * storage 改动会触发 sidepanel 端的 watch，反向 hydrate 内存 store，
 * 确保所有 context 看到的 @ 计数都一致。
 */
export function setupAtMe(): void {
  onMessage("atMeBump", async ({ data }) => {
    const cur = await atMeCountsStorage.getValue();
    const key = `${data.channelId}:${data.channelType}`;
    await atMeCountsStorage.setValue({ ...cur, [key]: (cur[key] ?? 0) + 1 });
  });

  onMessage("atMeClear", async ({ data }) => {
    const cur = await atMeCountsStorage.getValue();
    const key = `${data.channelId}:${data.channelType}`;
    if (cur[key] == null) return;
    const { [key]: _drop, ...rest } = cur;
    await atMeCountsStorage.setValue(rest);
  });
}
