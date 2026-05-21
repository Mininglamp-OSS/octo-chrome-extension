import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";

interface ChannelTarget {
  channelId: string;
  channelType: number;
}

/** 标记会话已读 (PUT /conversation/clearUnread) */
export function useClearUnread() {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn({ channelId, channelType }: ChannelTarget): Promise<void> {
      await api
        .put(Endpoints.clearUnread, {
          json: { channel_id: channelId, channel_type: channelType, unread: 0 },
        })
        .json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/** 上传消息已读 (POST /message/readed) */
export function useMarkMessagesRead() {
  return useMutation({
    async mutationFn({
      channelId,
      channelType,
      messageIds,
    }: ChannelTarget & { messageIds: string[] }): Promise<void> {
      if (messageIds.length === 0) return;
      await api
        .post(Endpoints.messageReaded, {
          json: { channel_id: channelId, channel_type: channelType, message_ids: messageIds },
        })
        .json();
    },
  });
}

/** 清空 channel 历史消息 */
export function useClearChannelMessages() {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn({ channelId, channelType }: ChannelTarget): Promise<void> {
      await api
        .post(Endpoints.channelClearMessages, {
          json: { channel_id: channelId, channel_type: channelType },
        })
        .json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/** 重命名群 */
export function useRenameGroup(channelId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn(payload: { name: string }): Promise<void> {
      if (!channelId) throw new Error("channelId required");
      await api.put(Endpoints.groupRename(channelId), { json: payload }).json();
    },
    onSuccess() {
      if (channelId) void qc.invalidateQueries({ queryKey: ["channel", 2, channelId] });
    },
  });
}

/** 退群 */
export function useExitGroup() {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn({ channelId }: { channelId: string }): Promise<void> {
      await api.post(Endpoints.groupExit(channelId)).json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/** 设置 channel mute/top 等（group 用 groups/:id/setting，private 用 users/:id/setting） */
export function useUpdateChannelSetting() {
  return useMutation({
    async mutationFn({
      channelId,
      channelType,
      setting,
    }: ChannelTarget & { setting: Record<string, unknown> }): Promise<void> {
      const url =
        channelType === 1
          ? Endpoints.userSetting(channelId)
          : Endpoints.groupSetting(channelId);
      await api.put(url, { json: setting }).json();
    },
  });
}
