import { browser } from "wxt/browser";

/**
 * 扩展图标红点：未读时 setIcon 切到带红点版本，无未读时还原。
 *
 * 与 c6797f7 删的旧 badge.ts 的差异：
 *  - 没有 setInterval 呼吸帧（SW 重启会泄漏定时器）
 *  - 只合成一次（启动时），缓存 ImageData
 *  - 串行 promise 链防止并发 setIcon 抖动
 *
 * 几何（v2 · bottom-right bead，参考 mirror）：
 *  - 位置右下角而非右上 —— octo 头/天线在上半部，右上角会被削；下半部是波浪 + 留白
 *  - 白底 + 实红双圆（mirror 同源），不用 stroke —— 半透明描边在 16px 下糊成奶红
 *  - 利用 icon 自带的 ~6% 透明边距：白圈外缘贴 canvas (size, size) 边
 *
 * 多尺寸：48 / 128 同时合成；chrome 不同 DPR 下不会模糊。
 * 小尺寸 16 不合成（双圆直径 ~3px 也糊），直接还原走 path 即可，未读态忽略 16px。
 */

const SIZES = [48, 128] as const;
const DOT_COLOR = "#F54A45";

const BASE_ICON_PATH: Record<string, string> = {
  "16": "/icon/16.png",
  "48": "/icon/48.png",
  "128": "/icon/128.png",
};

let framesCache: Record<number, ImageData> | null = null;
let chain: Promise<void> = Promise.resolve();

async function loadAndDot(size: number): Promise<ImageData | null> {
  try {
    const url = chrome.runtime.getURL(`/icon/${size}.png`);
    const resp = await fetch(url);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, size, size);
    // 右下角浮起小球：白底 + 实红双圆，贴 canvas 右下角
    // dotR / whiteR 比例参考 mirror，外缘恰好顶到 (size, size)，
    // 占用 icon 自带的 ~6% 透明边距 → 视觉上像挂在右下角
    const dotR = Math.round(size * 0.18);
    const whiteR = Math.round(size * 0.21);
    const cx = size - whiteR;
    const cy = size - whiteR;
    ctx.beginPath();
    ctx.fillStyle = "#FFFFFF";
    ctx.arc(cx, cy, whiteR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = DOT_COLOR;
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();
    return ctx.getImageData(0, 0, size, size);
  } catch (err) {
    console.warn(`[octo:bg] dot icon ${size} failed`, err);
    return null;
  }
}

async function ensureFrames(): Promise<Record<number, ImageData> | null> {
  if (framesCache) return framesCache;
  const entries = await Promise.all(SIZES.map(async (s) => [s, await loadAndDot(s)] as const));
  const map: Record<number, ImageData> = {};
  for (const [s, img] of entries) {
    if (img) map[s] = img;
  }
  if (Object.keys(map).length === 0) return null;
  framesCache = map;
  return framesCache;
}

async function doSet(hasUnread: boolean): Promise<void> {
  if (!hasUnread) {
    try {
      await browser.action.setIcon({ path: BASE_ICON_PATH });
    } catch (err) {
      console.warn("[octo:bg] setIcon(restore) failed", err);
    }
    return;
  }
  const frames = await ensureFrames();
  if (!frames) {
    // fallback：合成失败就回原图，不亮红点也比卡死好
    await browser.action.setIcon({ path: BASE_ICON_PATH });
    return;
  }
  try {
    await browser.action.setIcon({ imageData: frames });
  } catch (err) {
    console.warn("[octo:bg] setIcon(dot) failed", err);
  }
}

/** 设置未读红点状态。串行执行，无视调用频率。 */
export function setUnreadBadge(hasUnread: boolean): Promise<void> {
  chain = chain.then(() => doSet(hasUnread));
  return chain;
}

/** 装配（占位 —— badge 自身无监听器，由 notifications.ts / auth-sync.ts 主动调） */
export function setupBadge(): void {
  // noop
}
