import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { type Member, MemberListSchema } from "../schemas/member";

interface MemberQueryReq {
  channelId: string | null;
  keyword?: string;
  limit?: number;
}

export function useChannelMembers(req: MemberQueryReq) {
  return useQuery({
    queryKey: ["members", req.channelId, req.keyword ?? "", req.limit ?? 20],
    enabled: Boolean(req.channelId),
    async queryFn(): Promise<Member[]> {
      if (!req.channelId) return [];
      const searchParams: Record<string, string | number> = { limit: req.limit ?? 20 };
      if (req.keyword) searchParams.keyword = req.keyword;
      const data = await api.get(Endpoints.groupMembers(req.channelId), { searchParams }).json();
      return MemberListSchema.parse(data);
    },
    staleTime: 30_000,
  });
}
