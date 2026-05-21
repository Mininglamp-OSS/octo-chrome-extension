import { AppBoot } from "@/app/AppBoot";
import { LoginPage } from "@/components/octo/LoginPage";
import { OctoShell } from "@/components/octo/OctoShell";
import { useSidepanelBridge } from "@/hooks/useSidepanelBridge";
import { useAtMeWatcher } from "@/im/hooks/useAtMeWatcher";
import { selectIsLogined, useAuthStore } from "@/stores/auth";

export function SidepanelApp() {
  return (
    <AppBoot>
      <Gate />
    </AppBoot>
  );
}

function Gate() {
  useSidepanelBridge();
  useAtMeWatcher();
  const isLogined = useAuthStore(selectIsLogined);
  return isLogined ? <OctoShell /> : <LoginPage />;
}
