import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useSpaceStore } from "@/stores/space";
import { api } from "../client";
import { Endpoints } from "../endpoints";

const FriendSchema = z.object({
  uid: z.string(),
  name: z.string(),
  remark: z.string().optional().default(""),
  avatar: z.string().optional(),
  status: z.number().optional(),
  /** 'bot' 'user' 等 */
  category: z.string().optional(),
  /** 1 = AI/机器人；与 octo-web datasource.ts 行 521 同源 */
  robot: z.number().optional(),
  bot_type: z.number().optional(),
});
export type Friend = z.infer<typeof FriendSchema>;
const FriendListSchema = z.array(FriendSchema);

const BotSchema = z.object({
  uid: z.string(),
  name: z.string(),
  avatar: z.string().optional(),
  description: z.string().optional(),
});
export type Bot = z.infer<typeof BotSchema>;
const BotListSchema = z.array(BotSchema);

export function useFriends(version = 0) {
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  return useQuery({
    queryKey: ["friends", spaceId, version],
    enabled: !!spaceId,
    async queryFn(): Promise<Friend[]> {
      const data = await api
        .get(Endpoints.friendSync, { searchParams: { version, limit: 1000 } })
        .json();
      return FriendListSchema.parse(data);
    },
    staleTime: 60_000,
  });
}

export function useMyBots() {
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  return useQuery({
    queryKey: ["bots", "my", spaceId],
    async queryFn(): Promise<Bot[]> {
      const data = await api
        .get(Endpoints.myBots, { searchParams: spaceId ? { space_id: spaceId } : {} })
        .json();
      return BotListSchema.parse(data);
    },
    staleTime: 60_000,
  });
}
