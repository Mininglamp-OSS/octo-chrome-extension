import "yet-another-react-lightbox/styles.css";
import Lightbox from "yet-another-react-lightbox";
import Download from "yet-another-react-lightbox/plugins/download";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { useUIStore } from "@/stores/ui";

export function OctoLightbox() {
  const lightbox = useUIStore((s) => s.lightbox);
  const close = useUIStore((s) => s.closeLightbox);

  return (
    <Lightbox
      open={lightbox != null}
      close={close}
      slides={lightbox ? [{ src: lightbox.url, alt: lightbox.name, download: lightbox.url }] : []}
      plugins={[Download, Zoom]}
      controller={{ closeOnBackdropClick: true }}
      animation={{ swipe: 0, fade: 200 }}
    />
  );
}
