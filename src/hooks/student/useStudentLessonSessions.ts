import { useInfiniteQuery } from "@tanstack/react-query";

export type StudentSessionListItem = {
  id: string;
  title: string;
  subjectName: string | null;
  scheduledDate: string | null;
  studentVisibility: string;
  studied: boolean;
  hasNotebookNotes?: boolean;
  notebookNotesPublished?: boolean;
};

export type StudentSessionListResponse = {
  success: true;
  data: {
    sessions: StudentSessionListItem[];
    progress: {
      total: number;
      studiedCount: number;
      studiedPercent: number | null;
    };
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
  error?: undefined;
} | {
  success: false;
  error: string;
  data?: undefined;
};

const PAGE_SIZE = 30;

export function useStudentLessonSessions(enabled = true) {
  return useInfiniteQuery({
    queryKey: ["student-lesson-sessions", PAGE_SIZE],
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageParam),
      });
      const res = await fetch(`/api/student/lesson-sessions?${params}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as StudentSessionListResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(
          (json as { error?: string } | null)?.error || "Failed to load lessons"
        );
      }
      return json as Extract<StudentSessionListResponse, { success: true }>;
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

export { PAGE_SIZE as studentLessonSessionsPageSize };
