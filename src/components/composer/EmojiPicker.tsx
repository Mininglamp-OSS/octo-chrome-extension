import data from "@emoji-mart/data";
import { Picker } from "emoji-mart";
import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Sticker, useStickerCategories, useStickers } from "@/api/queries/stickers";
import { cn } from "@/utils/cn";
import { CUSTOM_EMOJIS, getCustomEmojiKeyById, getCustomEmojiUrl } from "@/utils/emoji";
import { resolveAttachmentUrl } from "@/utils/url";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onSticker?: (sticker: Sticker) => void;
  theme?: "light" | "dark" | "auto";
}

/** emoji-mart custom category：把 [使命必达] 等内置 PNG 注入到 picker */
const CUSTOM_CATEGORY = [
  {
    id: "octo-custom",
    name: "自定义",
    emojis: CUSTOM_EMOJIS.map((e) => ({
      id: e.id,
      name: e.name,
      keywords: [e.id, e.name],
      skins: [{ src: getCustomEmojiUrl(e.key) }],
    })),
  },
];

/** 自定义放最前，覆盖默认 Smileys & People 在前的顺序 */
const CATEGORY_ORDER = [
  "octo-custom",
  "frequent",
  "people",
  "nature",
  "foods",
  "activity",
  "places",
  "objects",
  "symbols",
  "flags",
];

/** emoji-mart i18n 中文化（对照官方 i18n 字典字段） */
const I18N_ZH = {
  search: "搜索",
  search_no_results_1: "未找到表情",
  search_no_results_2: "换个关键词试试",
  pick: "选个表情…",
  add_custom: "添加自定义表情",
  categories: {
    activity: "活动",
    custom: "自定义",
    flags: "旗帜",
    foods: "食物饮品",
    frequent: "常用",
    nature: "动植物",
    objects: "物品",
    people: "笑脸与人物",
    places: "旅行与地点",
    search: "搜索结果",
    symbols: "符号",
  },
  skins: {
    "1": "默认",
    "2": "浅色",
    "3": "中浅",
    "4": "中等",
    "5": "中深",
    "6": "深色",
    choose: "选择肤色",
  },
};

function EmojiTab({
  onSelect,
  theme,
}: {
  onSelect: (emoji: string) => void;
  theme: "light" | "dark" | "auto";
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const picker = new Picker({
      data,
      custom: CUSTOM_CATEGORY,
      categories: CATEGORY_ORDER,
      i18n: I18N_ZH,
      theme,
      onEmojiSelect: (e: { native?: string; id?: string }) => {
        if (e.native) {
          onSelect(e.native);
          return;
        }
        // 自定义表情：picker 不给 native，按 id 反查文本标记 [xxx]
        const key = e.id ? getCustomEmojiKeyById(e.id) : undefined;
        if (key) onSelect(key);
      },
      previewPosition: "none",
      skinTonePosition: "none",
      perLine: 8,
      maxFrequentRows: 1,
    }) as unknown as Node;
    el.appendChild(picker);
    return () => {
      el.innerHTML = "";
    };
  }, [onSelect, theme]);

  return <div ref={containerRef} />;
}

function StickerTab({
  category,
  onSticker,
}: {
  category: string;
  onSticker: (s: Sticker) => void;
}) {
  const { data: stickers, isLoading } = useStickers(category);
  if (isLoading) {
    return (
      <div className="flex h-[420px] w-[352px] items-center justify-center text-xs text-(--color-muted-foreground)">
        加载中…
      </div>
    );
  }
  const list = stickers ?? [];
  if (list.length === 0) {
    return (
      <div className="flex h-[420px] w-[352px] items-center justify-center text-xs text-(--color-muted-foreground)">
        该分类暂无表情
      </div>
    );
  }
  return (
    <div className="h-[420px] w-[352px] overflow-y-auto p-2">
      <div className="grid grid-cols-4 gap-2">
        {list.map((s) => {
          const src = resolveAttachmentUrl(s.path);
          return (
            <button
              key={s.path}
              type="button"
              onClick={() => onSticker(s)}
              className="flex aspect-square items-center justify-center rounded-md p-1 transition-colors hover:bg-(--color-accent)"
              title={s.category}
            >
              <img
                src={src}
                alt="sticker"
                className="block h-full w-full object-contain"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EmojiPicker({ onSelect, onSticker, theme = "auto" }: EmojiPickerProps) {
  const { data: categories } = useStickerCategories();
  const cats = categories ?? [];
  // active tab：emoji | <sticker category>
  const [active, setActive] = useState<string>("emoji");

  function handleSticker(s: Sticker): void {
    onSticker?.(s);
  }

  return (
    <div className="flex flex-col bg-(--color-popover)">
      {/* tab strip：表情包分类在前（对照 mirror EmojiPanel tab 排序：表情 + 分类） */}
      {cats.length > 0 && (
        <div className="flex items-center gap-1 border-(--color-border) border-b px-2 py-1.5">
          <button
            type="button"
            onClick={() => setActive("emoji")}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded transition-colors",
              active === "emoji"
                ? "bg-(--color-accent) text-(--color-foreground)"
                : "text-(--color-muted-foreground) hover:bg-(--color-accent)/60",
            )}
            title="标准表情"
          >
            <Smile className="h-4 w-4" />
          </button>
          {cats.map((c) => {
            const cover = resolveAttachmentUrl(c.cover);
            return (
              <button
                key={c.category}
                type="button"
                onClick={() => setActive(c.category)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded transition-colors",
                  active === c.category
                    ? "bg-(--color-accent)"
                    : "hover:bg-(--color-accent)/60",
                )}
                title={c.name ?? c.category}
              >
                {cover ? (
                  <img
                    src={cover}
                    alt={c.name ?? c.category}
                    className="h-5 w-5 object-contain"
                  />
                ) : (
                  <span className="text-[10px]">{(c.name ?? c.category).slice(0, 2)}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {active === "emoji" ? (
        <EmojiTab onSelect={onSelect} theme={theme} />
      ) : (
        <StickerTab category={active} onSticker={handleSticker} />
      )}
    </div>
  );
}
