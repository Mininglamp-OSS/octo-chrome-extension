import { ExternalLink } from "lucide-react";
import { usePreferencesStore } from "@/stores/preferences";
import { DEFAULT_API_URL } from "@/api/endpoints";

export function NoSpacePage() {
  const apiUrl = usePreferencesStore((s) => s.prefs.apiUrl)?.trim() || DEFAULT_API_URL;
  const webUrl = apiUrl.replace(/\/api\/?$/, "");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-4xl">👋</div>
      <h2 className="text-lg font-semibold">还没有加入任何空间</h2>
      <p className="text-sm text-(--color-muted-foreground)">
        请先在 Web 端创建或加入一个 Space
      </p>
      <a
        href={webUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-primary-foreground) transition-colors hover:bg-(--color-primary)/90"
      >
        打开 Web 端
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
