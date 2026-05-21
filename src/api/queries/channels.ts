import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { type ChannelInfo, ChannelInfoSchema } from "../schemas/channel";

export function useChannelInfo(channelId: string | null, channelType: number) {
  return useQuery({
    queryKey: ["channel", channelType, channelId],
    enabled: Boolean(channelId),
    async queryFn(): Promise<ChannelInfo> {
      const data = await api.get(Endpoints.channelInfo(channelId!, channelType)).json();
      return ChannelInfoSchema.parse(data);
    },
  });
}
