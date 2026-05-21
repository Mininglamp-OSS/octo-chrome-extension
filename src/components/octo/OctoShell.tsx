import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { useAutoSelectFirstConversation } from "@/im/hooks/useAutoSelectFirstConversation";
import { useImConnectionStatus } from "@/im/hooks/useImConnectionStatus";
import { useCategoriesUi } from "@/stores/categoriesUi";
import { useCurrentChannel } from "@/stores/currentChannel";
import { cn } from "@/utils/cn";
import { CategoriesManageModal } from "./CategoriesManageModal";
import { Conversation } from "./Conversation";
import { ConversationList } from "./ConversationList";
import { OctoLightbox } from "./Lightbox";
import { MoveToCategoryDialog } from "./MoveToCategoryDialog";
import { OctoContactsDrawer } from "./OctoContactsDrawer";
import { OctoInfoDrawer } from "./OctoInfoDrawer";
import { PickerDrawer } from "./PickerDrawer";
import { SidepanelRightColumn } from "./SidepanelRightColumn";
import { SidepanelTopbar } from "./SidepanelTopbar";
import { ThreadSheet } from "./ThreadSheet";

type PickerTab = "group" | "dm";

export function OctoShell() {
  const channelId = useCurrentChannel((s) => s.channelId);
  const channelType = useCurrentChannel((s) => s.channelType);
  const status = useImConnectionStatus();
  const manageOpen = useCategoriesUi((s) => s.manageOpen);
  const closeManage = useCategoriesUi((s) => s.closeManage);
  const moveTarget = useCategoriesUi((s) => s.moveTarget);
  const closeMoveTo = useCategoriesUi((s) => s.closeMoveTo);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>("group");

  // 切换 space / 首次加载时：未选中频道则自动选第一条会话（mirror syncPinsAndFirstSelect 等价）
  useAutoSelectFirstConversation();

  // 打开 picker 时记录"进入前的频道"，用户选了新的就自动关 drawer
  const initialChannelRef = useRef<{ id: string | null; type: number | null }>({
    id: null,
    type: null,
  });
  useEffect(() => {
    if (!pickerOpen) return;
    if (
      channelId !== initialChannelRef.current.id ||
      channelType !== initialChannelRef.current.type
    ) {
      setPickerOpen(false);
    }
  }, [pickerOpen, channelId, channelType]);

  function openPicker(): void {
    initialChannelRef.current = { id: channelId, type: channelType };
    setPickerOpen(true);
  }

  return (
    <div className="relative flex h-full flex-col">
      <SidepanelTopbar />

      {/* 未连接的小提示横条 */}
      {status !== 1 && (
        <div className="flex h-6 shrink-0 items-center justify-center gap-1 border-b bg-(--color-muted)/30 text-[11px] text-(--color-muted-foreground)">
          <WifiOff className="h-3 w-3" />
          <span>{status === 2 ? "连接中…" : "未连接"}</span>
        </div>
      )}

      {/* 主区：左 content + 右 column（rail + footer icons）。
          主区永远渲染 <Conversation />；选频道走 picker drawer，对齐 mirror 的 OctoSidepanelLayout。 */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <Conversation />
        </div>
        <SidepanelRightColumn onShowPicker={openPicker} />
      </div>

      {/* picker drawer：mirror wk-sidepanel-picker-drawer 等价。
          PickerDrawer 自带左滑动画 + rail 蒙层 + 点蒙层关闭 + ESC 关闭。 */}
      <PickerDrawer open={pickerOpen} onClose={() => setPickerOpen(false)}>
        {/* mirror octo-picker-filter-tabs：胶囊 13px，padding 6px 14px，gap 4px */}
        <div className="flex shrink-0 gap-1 px-3 pt-2 pb-2.5">
          {(
            [
              { id: "group" as const, label: "群聊" },
              { id: "dm" as const, label: "私聊" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPickerTab(t.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                pickerTab === t.id
                  ? "bg-(--color-accent) font-semibold text-(--color-foreground)"
                  : "text-(--color-muted-foreground) hover:bg-(--color-accent)/40",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1">
          <ConversationList picker filter={pickerTab} />
        </div>
      </PickerDrawer>

      <OctoLightbox />
      <ThreadSheet />
      <OctoInfoDrawer />
      <OctoContactsDrawer />
      <CategoriesManageModal open={manageOpen} onClose={closeManage} />
      {moveTarget && (
        <MoveToCategoryDialog open onClose={closeMoveTo} groupNo={moveTarget} />
      )}
    </div>
  );
}
