import { useMutation } from "@tanstack/react-query";
import { emitImMessageRevoked } from "@/im/client";
import { useAuthStore } from "@/stores/auth";
import { api } from "../client";
import { Endpoints } from "../endpoints";

interface RevokePayload {
  channelId: string;
  channelType: number;
  messageId: string;
  clientMsgNo?: string;
}

export function useRevokeMessage() {
  return useMutation({
    async mutationFn(payload: RevokePayload): Promise<void> {
      const searchParams: Record<string, string | number> = {
        channel_id: payload.channelId,
        channel_type: payload.channelType,
        message_id: payload.messageId,
      };
      if (payload.clientMsgNo) searchParams.client_msg_no = payload.clientMsgNo;
      await api.post(Endpoints.revokeMessage, { searchParams }).json();
    },
    onSuccess(_, payload) {
      // 本地立刻派发 revoke 事件，不赌 SDK CMD 回推
      // （自撤场景 CMD 经常因为 messageId 类型/通道差异落空）
      emitImMessageRevoked({
        messageId: payload.messageId,
        channelId: payload.channelId,
        channelType: payload.channelType,
        revoker: useAuthStore.getState().state?.uid ?? "",
      });
    },
  });
}
