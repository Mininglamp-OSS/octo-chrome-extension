import { browser } from "wxt/browser";

const BADGE_BG = "#d24747";
const BREATHING_FRAMES = 20;
const BREATHING_INTERVAL_MS = 100;
const DOT_OPACITY_MIN = 0.35;
const DOT_OPACITY_MAX = 1.0;

let breathingTimer: number | null = null;
let baseImage: ImageData | null = null;
let frames: ImageData[] = [];
let currentFrame = 0;

async function getBaseIcon(): Promise<ImageData | null> {
  if (baseImage) return baseImage;
  try {
    const url = browser.runtime.getURL("/icon/48.png");
    const resp = await fetch(url);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    baseImage = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return baseImage;
  } catch {
    return null;
  }
}

function renderDotFrame(base: ImageData, opacity: number): ImageData {
  const w = base.width;
  const h = base.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return base;
  ctx.putImageData(base, 0, 0);
  // 右上角小红点
  const r = Math.floor(Math.min(w, h) * 0.22);
  const cx = w - r - 2;
  const cy = r + 2;
  ctx.beginPath();
  ctx.fillStyle = `rgba(210, 71, 71, ${opacity})`;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  return ctx.getImageData(0, 0, w, h);
}

async function ensureFrames(): Promise<void> {
  if (frames.length > 0) return;
  const base = await getBaseIcon();
  if (!base) return;
  for (let i = 0; i < BREATHING_FRAMES; i += 1) {
    const t = (i / BREATHING_FRAMES) * Math.PI * 2;
    const opacity =
      DOT_OPACITY_MIN +
      ((DOT_OPACITY_MAX - DOT_OPACITY_MIN) * (Math.sin(t) + 1)) / 2;
    frames.push(renderDotFrame(base, opacity));
  }
}

function stopBreathing(): void {
  if (breathingTimer != null) {
    clearInterval(breathingTimer);
    breathingTimer = null;
  }
  void browser.action.setIcon({ path: { "48": "/icon/48.png" } });
}

async function startBreathing(): Promise<void> {
  if (breathingTimer != null) return;
  await ensureFrames();
  if (frames.length === 0) return;
  currentFrame = 0;
  breathingTimer = setInterval(() => {
    const f = frames[currentFrame];
    if (!f) return;
    void (browser.action.setIcon as unknown as (d: { imageData: ImageData }) => Promise<void>)({
      imageData: f,
    });
    currentFrame = (currentFrame + 1) % frames.length;
  }, BREATHING_INTERVAL_MS) as unknown as number;
}

export async function setUnreadBadge(hasUnread: boolean, count?: number): Promise<void> {
  if (!hasUnread) {
    await browser.action.setBadgeText({ text: "" });
    stopBreathing();
    return;
  }
  await browser.action.setBadgeBackgroundColor({ color: BADGE_BG });
  const text = count == null ? "" : count > 99 ? "99+" : String(count);
  await browser.action.setBadgeText({ text });
  void startBreathing();
}
