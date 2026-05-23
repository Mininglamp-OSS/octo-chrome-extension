import { Bell, BellOff, Pin, PinOff, Edit2, Trash2, LogOut, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useChannelInfo } from "@/api/queries/channels";
import {
  useClearChannelMessages,
  useExitGroup,
  useRenameGroup,
  useUpdateChannelSetting,
} from "@/api/queries/channelActions";
import { useChannelMembers } from "@/api/queries/members";
import { useAddPinned, usePinned, useRemovePinned } from "@/api/queries/pinned";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getApiUrl } from "@/api/url";
import { ChannelType } from "@/const/channel";
import { useCurrentChannel } from "@/stores/currentChannel";
import { useDrawerStore } from "@/stores/drawer";
import { selectCurrentSpaceId, useSpaceStore } from "@/stores/space";
import {
  avatarGradient,
  channelAvatarUrl,
  getFirstChar,
  resolveImageURL,
  resolvePersonAvatar,
} from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

export function OctoInfoDrawer() {
  const open = useDrawerStore((s) => s.info);
  const close = useDrawerStore((s) => s.closeInfo);
  const channelId = useCurrentChannel((s) => s.channelId);
  const channelType = useCurrentChannel((s) => s.channelType);
  const clearCurrent = useCurrentChannel((s) => s.clear);

  const { data: info } = useChannelInfo(channelId, channelType);
  const isGroup = channelType !== ChannelType.person;
  const { data: members } = useChannelMembers({
    channelId: isGroup ? channelId : null,
    limit: 200,
  });
  const { data: pinned } = usePinned();
  const isPinned = pinned?.some(
    (p) => p.channel_id === channelId && p.channel_type === channelType,
  );

  const addPin = useAddPinned();
  const removePin = useRemovePinned();
  const updateSetting = useUpdateChannelSetting();
  const renameMut = useRenameGroup(channelId);
  const clearMut = useClearChannelMessages();
  const exitMut = useExitGroup();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const muted = (info?.mute ?? 0) === 1;

  const spaceId = useSpaceStore(selectCurrentSpaceId);
  const baseURL = getApiUrl();
  const channelLogo = info?.logo?.trim() || info?.avatar?.trim();
  const channelAvatarSrc = !channelId
    ? ""
    : channelType === ChannelType.person
      ? resolvePersonAvatar({
          baseURL,
          channelId,
          spaceId,
          ...(channelLogo && { logo: channelLogo }),
        })
      : channelLogo
        ? resolveImageURL(baseURL, channelLogo)
        : channelAvatarUrl(baseURL, channelId, channelType, spaceId);

  async function togglePin(): Promise<void> {
    if (!channelId) return;
    try {
      if (isPinned) await removePin.mutateAsync({ channelId, channelType });
      else await addPin.mutateAsync({ channelId, channelType });
    } catch (err) {
      toast.error(extractErrorMsg(err) || "操作失败");
    }
  }

  async function toggleMute(): Promise<void> {
    if (!channelId) return;
    try {
      await updateSetting.mutateAsync({
        channelId,
        channelType,
        setting: { mute: muted ? 0 : 1 },
      });
      toast.success(muted ? "已开启提醒" : "已静音");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "操作失败");
    }
  }

  async function commitRename(): Promise<void> {
    if (!nameDraft.trim() || !channelId) return;
    try {
      await renameMut.mutateAsync({ name: nameDraft.trim() });
      toast.success("已重命名");
      setEditingName(false);
    } catch (err) {
      toast.error(extractErrorMsg(err) || "重命名失败");
    }
  }

  async function onClearMessages(): Promise<void> {
    if (!channelId) return;
    if (!confirm("清空该会话所有消息？此操作不可撤销")) return;
    try {
      await clearMut.mutateAsync({ channelId, channelType });
      toast.success("已清空");
    } catch (err) {
      toast.error(extractErrorMsg(err) || "清空失败");
    }
  }

  async function onLeaveGroup(): Promise<void> {
    if (!channelId) return;
    if (!confirm("退出该群聊？")) return;
    try {
      await exitMut.mutateAsync({ channelId });
      toast.success("已退出");
      close();
      clearCurrent();
    } catch (err) {
      toast.error(extractErrorMsg(err) || "退群失败");
    }
  }

  const aiMembers = members?.filter((m) => /bot/i.test(m.uid)) ?? [];
  const humanMembers = members?.filter((m) => !/bot/i.test(m.uid)) ?? [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="flex w-full max-w-sm flex-col p-0">
        <SheetHeader className="border-b px-4 pb-3 pt-4">
          <SheetTitle className="text-sm">会话信息</SheetTitle>
          <SheetDescription className="sr-only">查看与管理当前会话</SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col items-center gap-2 px-4 py-5">
            <Avatar className="h-16 w-16">
              {channelAvatarSrc && (
                <AvatarImage src={channelAvatarSrc} alt={info?.name ?? ""} />
              )}
              <AvatarFallback
                className="text-lg text-white"
                style={{ background: avatarGradient(info?.name ?? channelId ?? "") }}
              >
                {getFirstChar(info?.name ?? channelId ?? "?")}
              </AvatarFallback>
            </Avatar>
            {editingName ? (
              <div className="flex w-full max-w-xs items-center gap-1">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="h-8"
                />
                <Button size="icon" className="h-8 w-8" onClick={() => void commitRename()}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">{info?.name ?? channelId}</span>
                {isGroup && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setNameDraft(info?.name ?? "");
                      setEditingName(true);
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-1 px-2 py-2">
            <SettingRow
              icon={isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              label={isPinned ? "取消置顶" : "置顶会话"}
              onClick={() => void togglePin()}
            />
            <SettingRow
              icon={muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              label={muted ? "开启提醒" : "免打扰"}
              onClick={() => void toggleMute()}
            />
          </div>

          {isGroup && (members?.length ?? 0) > 0 && (
            <>
              <Separator />
              <div className="px-4 py-3">
                <p className="mb-2 text-xs font-medium text-(--color-muted-foreground)">
                  成员 {members?.length ?? 0}
                </p>
                {aiMembers.length > 0 && (
                  <MemberGroup
                    title="AI 伙伴"
                    members={aiMembers}
                    spaceId={spaceId}
                  />
                )}
                {humanMembers.length > 0 && (
                  <MemberGroup
                    title="成员"
                    members={humanMembers}
                    spaceId={spaceId}
                  />
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="flex flex-col gap-1 px-2 py-2">
            <SettingRow
              icon={<Trash2 className="h-4 w-4" />}
              label="清空消息"
              onClick={() => void onClearMessages()}
              destructive
            />
            {isGroup && (
              <SettingRow
                icon={<LogOut className="h-4 w-4" />}
                label="退出群聊"
                onClick={() => void onLeaveGroup()}
                destructive
              />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SettingRow({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-(--color-accent)/40",
        destructive && "text-(--color-destructive)",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MemberGroup({
  title,
  members,
  spaceId,
}: {
  title: string;
  members: Array<{ uid: string; name: string; avatar?: string }>;
  spaceId: string | null;
}) {
  const baseURL = getApiUrl();
  return (
    <div className="mb-3">
      <p className="mb-1 text-[10px] text-(--color-muted-foreground)">{title}</p>
      <div className="flex flex-wrap gap-2">
        {members.slice(0, 30).map((m) => {
          const memberAvatar = resolvePersonAvatar({
            baseURL,
            channelId: m.uid,
            spaceId,
            ...(m.avatar?.trim() && { logo: m.avatar }),
          });
          return (
            <div key={m.uid} className="flex w-12 flex-col items-center gap-1">
              <Avatar className="h-9 w-9">
                {memberAvatar && <AvatarImage src={memberAvatar} alt={m.name} />}
                <AvatarFallback
                  className="text-[10px] text-white"
                  style={{ background: avatarGradient(m.name) }}
                >
                  {getFirstChar(m.name)}
                </AvatarFallback>
              </Avatar>
              <span className="w-full truncate text-center text-[10px]">{m.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
