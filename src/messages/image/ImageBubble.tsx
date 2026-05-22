import { useUIStore } from "@/stores/ui";
import type { ImageContent } from "./ImageMessage";

export function ImageBubble({ data }: { data: ImageContent }) {
  const openLightbox = useUIStore((s) => s.openLightbox);
  if (!data.url) return null;
  const aspectStyle =
    data.width > 0 && data.height > 0 ? { aspectRatio: `${data.width} / ${data.height}` } : {};
  return (
    <button
      type="button"
      onClick={() => openLightbox({ url: data.url, name: data.name ?? "image" })}
      className="octo-msg-image block max-w-[220px] overflow-hidden rounded-[10px]"
    >
      <img
        src={data.url}
        alt={data.name ?? "image"}
        className="block h-auto max-h-[260px] w-auto max-w-[220px] object-cover"
        style={aspectStyle}
        loading="lazy"
      />
    </button>
  );
}
