import { useMutation } from "@tanstack/react-query";
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
  });
}
