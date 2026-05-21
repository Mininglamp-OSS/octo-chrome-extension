import { createMenu, onMenuClicked, removeAllMenus } from "@/platform/contextMenus";
import { preferencesStorage } from "@/platform/storage";

const ID_NOTIF_ON = "octo:notif-on";
const ID_NOTIF_OFF = "octo:notif-off";
const ID_SYSTEM_ON = "octo:system-on";
const ID_SYSTEM_OFF = "octo:system-off";

async function rebuild(): Promise<void> {
  await removeAllMenus();
  const prefs = await preferencesStorage.getValue();
  if (prefs.notificationsEnabled) {
    await createMenu({ id: ID_NOTIF_OFF, title: "关闭消息通知", contexts: ["action"] });
  } else {
    await createMenu({ id: ID_NOTIF_ON, title: "开启消息通知", contexts: ["action"] });
  }
  if (prefs.notificationsVisible) {
    await createMenu({ id: ID_SYSTEM_OFF, title: "关闭系统弹窗", contexts: ["action"] });
  } else {
    await createMenu({ id: ID_SYSTEM_ON, title: "开启系统弹窗", contexts: ["action"] });
  }
}

export function setupMenus(): void {
  void rebuild();
  preferencesStorage.watch(() => {
    void rebuild();
  });
  onMenuClicked(async (id) => {
    const prefs = await preferencesStorage.getValue();
    switch (id) {
      case ID_NOTIF_ON:
        await preferencesStorage.setValue({ ...prefs, notificationsEnabled: true });
        break;
      case ID_NOTIF_OFF:
        await preferencesStorage.setValue({ ...prefs, notificationsEnabled: false });
        break;
      case ID_SYSTEM_ON:
        await preferencesStorage.setValue({ ...prefs, notificationsVisible: true });
        break;
      case ID_SYSTEM_OFF:
        await preferencesStorage.setValue({ ...prefs, notificationsVisible: false });
        break;
    }
  });
}
