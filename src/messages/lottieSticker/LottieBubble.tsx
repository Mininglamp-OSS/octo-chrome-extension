import { resolveAttachmentUrl } from "@/utils/url";
import type { LottieStickerContent } from "./LottieStickerMessage";

export function LottieBubble({ data }: { data: LottieStickerContent }) {
  // 表情包：优先用 url（真实贴图），fallback 到 placeholder（缩略图）。
  // 对照 mirror Messages/LottieSticker：固定高度 120px，宽度按比例
  const src = resolveAttachmentUrl(data.url) || resolveAttachmentUrl(data.placeholder);
  if (!src) return <span className="text-sm">[贴图]</span>;
  return (
    <img
      src={src}
      alt="sticker"
      className="octo-msg-sticker block h-[120px] w-auto max-w-full object-contain"
      loading="lazy"
    />
  );
}
