import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { conversationsQueryKey } from "./conversations";

/**
 * 私聊 channelId 在 Space 模式下被包成 `s{32hex}_{realUid}`，
 * 调 `users/{uid}/setting` 必须剥前缀拿真实 uid。
 * 对应 mirror SpacePrefix.ts + DataSourceModule.extractUID。
 */
const SPACE_PREFIX_RE = /^s[0-9a-f]{32}_/;
function extractRealUid(channelId: string): string {
  if (SPACE_PREFIX_RE.test(channelId)) {
    return channelId.substring(channelId.indexOf("_") + 1);
  }
  return channelId;
}

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

/** 设置 channel mute/top 等（group 用 groups/:id/setting，private 用 users/:realUid/setting） */
export function useUpdateChannelSetting() {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn({
      channelId,
      channelType,
      setting,
    }: ChannelTarget & { setting: Record<string, unknown> }): Promise<void> {
      const url =
        channelType === 1
          ? Endpoints.userSetting(extractRealUid(channelId))
          : Endpoints.groupSetting(channelId);
      await api.put(url, { json: setting }).json();
    },
    onSuccess(_, { channelId, channelType }) {
      // 触发 conversation/sync 重拉 —— stick 字段变更后才能反映到 pinned 排序
      void qc.invalidateQueries({ queryKey: ["im", "conversations"] });
      // channelInfo 缓存也失效
      void qc.invalidateQueries({ queryKey: ["channel", channelType, channelId] });
    },
  });
}

/** 切换会话置顶（top=1/0）—— 跟 Rail Pin（/user/pinned）是两套，互不影响。
 *  后端 setting 接口接收字段名是 `top`（不是 `stick`，stick 仅出现在 conversation/sync 响应里），
 *  对照 octo-server modules/user/api_setting.go:53 + modules/group/api_setting.go */
export function useToggleConversationTop() {
  const update = useUpdateChannelSetting();
  return {
    ...update,
    mutateAsync(payload: ChannelTarget & { top: boolean }) {
      return update.mutateAsync({
        channelId: payload.channelId,
        channelType: payload.channelType,
        setting: { top: payload.top ? 1 : 0 },
      });
    },
  };
}

// 防止打包后 conversationsQueryKey 因为只在闭包里间接用被 tree-shake 提示 unused
void conversationsQueryKey;
