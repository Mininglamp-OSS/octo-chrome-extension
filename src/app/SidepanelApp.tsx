import { AppBoot } from "@/app/AppBoot";
import { useSpaces } from "@/api/queries/spaces";
import { LoginPage } from "@/components/octo/LoginPage";
import { NoSpacePage } from "@/components/octo/NoSpacePage";
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
  if (!isLogined) return <LoginPage />;
  return <SpaceGate />;
}

function SpaceGate() {
  const { data: spaces, isLoading } = useSpaces();
  if (isLoading) return null;
  if (!spaces || spaces.length === 0) return <NoSpacePage />;
  return <OctoShell />;
}
