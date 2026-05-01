import { useQuery } from "@tanstack/react-query";

export type ParentWardLessonRow = {
  id: string;
  title: string;
  subjectName: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  hasParentSummary: boolean;
};

export type ParentWardLessonsResponse =
  | {
      success: true;
      data: { visible: false; lessons: [] };
    }
  | {
      success: true;
      data: { visible: true; lessons: ParentWardLessonRow[] };
    }
  | { success: false; error: string };

export function useParentWardLessons(wardId: string | null) {
  return useQuery({
    queryKey: ["parent-ward-lessons", wardId],
    queryFn: async (): Promise<ParentWardLessonsResponse> => {
      const res = await fetch(`/api/parent/wards/${wardId}/lessons`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ParentWardLessonsResponse | null;
      if (!res.ok || !json || json.success !== true) {
        throw new Error(
          json && "error" in json && typeof json.error === "string"
            ? json.error
            : "Failed to load lessons"
        );
      }
      return json;
    },
    enabled: Boolean(wardId),
    staleTime: 60_000,
  });
}
