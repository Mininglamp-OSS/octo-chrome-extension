import { Layers, MoveUpRight } from "lucide-react";
import { useMemo } from "react";
import type { MessageRender } from "@/messages/core/defineMessageType";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/utils/cn";
import type { MergeForwardContent, MergeForwardUser } from "./index";
import { subDigest } from "./lazyDecode";
import { mergeForwardTitle } from "./titleOf";

const PREVIEW_MAX = 4;

export const MergeForwardBubble: MessageRender<MergeForwardContent> = ({ data }) => {
  const stackLen = useUIStore((s) => s.mergeForwardStack.length);
  const openMergeForward = useUIStore((s) => s.openMergeForward);
  const pushMergeForward = useUIStore((s) => s.pushMergeForward);

  // 在主聊天列表里看到的卡片 = card 样式（stack 空）；详情面板里嵌套出现 = nested 样式
  const isNested = stackLen > 0;

  const title = mergeForwardTitle(data);
  const userMap = useMemo(() => buildUserMap(data.users), [data.users]);
  const previews = useMemo(
    () =>
      data.msgs.slice(0, PREVIEW_MAX).map((m) => ({
        name: nameOf(m.fromUid, userMap),
        digest: subDigest(m),
        key: m.messageId,
      })),
    [data.msgs, userMap],
  );

  function onClick(): void {
    if (isNested) pushMergeForward(data);
    else openMergeForward(data);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "octo-msg-mf relative block w-full max-w-[300px] text-left",
        // 主聊天里走「nest 进气泡」卡：父行 .octo-msg-bubble 已退化为 4px 边框，
        // 这里只画 accent 左竖线 + 浅灰底；嵌套面板里仍用旧的"独立卡"样式。
        isNested
          ? "max-w-[220px] rounded-lg overflow-hidden bg-(--color-background) border border-(--color-border)/70 hover:border-(--color-border)"
          : "rounded-r-[10px] overflow-hidden border-l-2 border-(--color-primary)/70 bg-(--color-foreground)/4 hover:bg-(--color-foreground)/6 transition-colors",
      )}
    >
      {isNested && (
        <span
          className={cn(
            "absolute right-2 top-2 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
            "bg-(--color-primary)/8 text-(--color-primary)",
          )}
        >
          <MoveUpRight className="h-2.5 w-2.5" />
          展开
        </span>
      )}

      <div className={cn("flex flex-col gap-2", isNested ? "px-3 pt-2.5 pb-0" : "px-3 pt-3 pb-0")}>
        <div
          className={cn(
            "truncate font-semibold text-(--color-foreground)",
            isNested ? "pr-12 text-[12.5px] leading-snug" : "text-sm leading-snug",
          )}
        >
          {title}
        </div>

        <div className="flex flex-col gap-1 pb-2.5">
          {previews.map((p) => (
            <div
              key={p.key}
              className={cn(
                "truncate text-(--color-muted-foreground)",
                isNested ? "text-[11.5px] leading-[1.45]" : "text-xs leading-[1.45]",
              )}
            >
              <span className="mr-1 font-medium text-(--color-primary)/80">{p.name}:</span>
              {p.digest}
            </div>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 border-t border-(--color-border)/70 px-3 py-1.5 text-[10.5px] tracking-wide text-(--color-muted-foreground)",
        )}
      >
        <Layers className="h-3 w-3 opacity-70" />
        聊天记录
      </div>
    </button>
  );
};

function buildUserMap(users: MergeForwardUser[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const u of users) m.set(u.uid, u.name);
  return m;
}

function nameOf(uid: string, map: Map<string, string>): string {
  return map.get(uid) || uid.slice(0, 6) || "未知";
}
