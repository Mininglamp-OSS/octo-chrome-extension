import { useEffect, useRef, useState } from "react";
import { useAutoSelectFirstConversation } from "@/im/hooks/useAutoSelectFirstConversation";
import { MergeForwardPanel } from "@/messages/mergeForward/MergeForwardPanel";
import { useCategoriesUi } from "@/stores/categoriesUi";
import { useCurrentChannel } from "@/stores/currentChannel";
import { CategoriesManageModal } from "./CategoriesManageModal";
import { Conversation } from "./Conversation";
import { ConversationList } from "./ConversationList";
import { OctoLightbox } from "./Lightbox";
import { MoveToCategoryDialog } from "./MoveToCategoryDialog";
import { OctoContactsDrawer } from "./OctoContactsDrawer";
import { OctoInfoDrawer } from "./OctoInfoDrawer";
import { PickerDrawer } from "./PickerDrawer";
import { type ConversationTab, SidebarTabBar } from "./SidebarTabBar";
import { SidepanelRightColumn } from "./SidepanelRightColumn";
import { SidepanelTopbar } from "./SidepanelTopbar";
import { ThreadSheet } from "./ThreadSheet";

export function OctoShell() {
  const channelId = useCurrentChannel((s) => s.channelId);
  const channelType = useCurrentChannel((s) => s.channelType);
  const manageOpen = useCategoriesUi((s) => s.manageOpen);
  const closeManage = useCategoriesUi((s) => s.closeManage);
  const moveTarget = useCategoriesUi((s) => s.moveTarget);
  const closeMoveTo = useCategoriesUi((s) => s.closeMoveTo);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<ConversationTab>("group");

  // 切换 space / 首次加载时：未选中频道则自动选第一条会话
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

      {/* mirror OctoSidepanelLayout：主屏永远显 Conversation，rail 在右；
          切会话靠 PickerDrawer，从左边滑出覆盖在 Conversation 上 */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <Conversation />
        </div>
        <SidepanelRightColumn onShowPicker={openPicker} />
      </div>

      {/* mirror wk-sidepanel-picker-drawer 等价：tab + ConversationList(picker) */}
      <PickerDrawer open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <SidebarTabBar activeTab={pickerTab} onTabChange={setPickerTab} />
        <div className="min-h-0 flex-1">
          <ConversationList picker filter={pickerTab} />
        </div>
      </PickerDrawer>

      <OctoLightbox />
      <ThreadSheet />
      <OctoInfoDrawer />
      <OctoContactsDrawer />
      <MergeForwardPanel />
      <CategoriesManageModal open={manageOpen} onClose={closeManage} />
      {moveTarget && <MoveToCategoryDialog open onClose={closeMoveTo} groupNo={moveTarget} />}
    </div>
  );
}
