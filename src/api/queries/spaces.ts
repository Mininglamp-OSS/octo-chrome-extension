import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import {
  type Space,
  SpaceListSchema,
  type SpaceMember,
  SpaceMemberListSchema,
  SpaceSchema,
} from "../schemas/space";

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

/**
 * 空间成员（mirror SpaceService.getMembers 等价）。
 * 默认 limit=500：mirror 通讯录默认拉首页 500，超过得做滚动分页（待办）
 */
export function useSpaceMembers(spaceId: string | null, opts?: { enabled?: boolean }) {
  const enabled = (opts?.enabled ?? true) && Boolean(spaceId);
  return useQuery({
    queryKey: ["spaceMembers", spaceId],
    enabled,
    staleTime: 60_000,
    async queryFn(): Promise<SpaceMember[]> {
      const data = await api
        .get(Endpoints.spaceMembers(spaceId!), { searchParams: { page: 1, limit: 500 } })
        .json();
      return SpaceMemberListSchema.parse(data ?? []);
    },
  });
}
