import { useQuery } from "@tanstack/react-query";
import { useSpaceStore } from "@/stores/space";
import { api } from "../client";
import { Endpoints } from "../endpoints";
import { SearchResultSchema, type SearchResult } from "../schemas/search";

export function useGlobalSearch(keyword: string) {
  const spaceId = useSpaceStore((s) => s.currentSpaceId);
  return useQuery({
    queryKey: ["search", "global", spaceId, keyword],
    enabled: keyword.trim().length > 0,
    async queryFn(): Promise<SearchResult> {
      const searchParams: Record<string, string> = { keyword: keyword.trim() };
      if (spaceId) searchParams.space_id = spaceId;
      const data = await api.get(Endpoints.searchGlobal, { searchParams }).json();
      return SearchResultSchema.parse(data);
    },
    staleTime: 15_000,
  });
}
