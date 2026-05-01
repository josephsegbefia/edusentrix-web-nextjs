import { useInfiniteQuery } from "@tanstack/react-query";
import type { StudentLessonsListResponse } from "@/types/lessons";

const PAGE_SIZE = 30;

export function useStudentLessons(enabled = true) {
  return useInfiniteQuery({
    queryKey: ["student-lessons", PAGE_SIZE],
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageParam),
      });
      const res = await fetch(`/api/student/lessons?${params}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as StudentLessonsListResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load lessons");
      }
      return json as StudentLessonsListResponse;
    },
    getNextPageParam: (lastPage) => {
      const p = lastPage.data.pagination;
      if (!p?.hasMore) return undefined;
      return p.offset + p.limit;
    },
    enabled,
    staleTime: 60_000,
  });
}

export { PAGE_SIZE as studentLessonsPageSize };
