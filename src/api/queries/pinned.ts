import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSpaceStore } from "@/stores/space";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { type PinnedItem, PinnedListSchema } from "../schemas/pinned";

/** mirror PinnedService 行为：始终带上 space_id（空时传空字符串），后端按它分库 */
function spaceParam(spaceId: string | null): Record<string, string> {
  return { space_id: spaceId ?? "" };
}

export function usePinned() {
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  return useQuery({
    queryKey: ["pinned", spaceId],
    async queryFn(): Promise<PinnedItem[]> {
      try {
        const data = await api
          .get(Endpoints.pinned, { searchParams: spaceParam(spaceId) })
          .json();
        return PinnedListSchema.parse(data ?? []);
      } catch (err) {
        console.debug("[octo:pinned] list failed, treating as empty", err);
        return [];
      }
    },
  });
}

export function useAddPinned() {
  const qc = useQueryClient();
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  return useMutation({
    async mutationFn(payload: { channelId: string; channelType: number }): Promise<void> {
      await api
        .post(Endpoints.pinned, {
          json: { channel_id: payload.channelId, channel_type: payload.channelType },
          searchParams: spaceParam(spaceId),
        })
        .json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["pinned", spaceId] });
    },
  });
}

export function useRemovePinned() {
  const qc = useQueryClient();
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  return useMutation({
    async mutationFn(payload: { channelId: string; channelType: number }): Promise<void> {
      await api
        .delete(Endpoints.pinned, {
          searchParams: {
            ...spaceParam(spaceId),
            channel_id: payload.channelId,
            channel_type: payload.channelType,
          },
        })
        .json();
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: ["pinned", spaceId] });
    },
  });
}
