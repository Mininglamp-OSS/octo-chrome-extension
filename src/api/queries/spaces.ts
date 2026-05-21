import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { type Space, SpaceListSchema, SpaceSchema } from "../schemas/space";

export function useSpaces() {
  return useQuery({
    queryKey: ["spaces", "list"],
    async queryFn(): Promise<Space[]> {
      try {
        const data = await api.get(Endpoints.spaces).json();
        return SpaceListSchema.parse(data ?? []);
      } catch (err) {
        console.debug("[octo:spaces] list failed, treating as empty", err);
        return [];
      }
    },
  });
}

export function useSpace(spaceId: string | null) {
  return useQuery({
    queryKey: ["spaces", spaceId],
    enabled: Boolean(spaceId),
    async queryFn(): Promise<Space> {
      const data = await api.get(Endpoints.spaceInfo(spaceId!)).json();
      return SpaceSchema.parse(data);
    },
  });
}
