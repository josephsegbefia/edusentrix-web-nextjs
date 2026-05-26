import { useQuery } from "@tanstack/react-query";

export type ParentWardSessionRow = {
  id: string;
  title: string;
  subjectName: string | null;
  scheduledDate: string | null;
  hasParentSummary: boolean;
};

export type ParentWardSessionsResponse =
  | {
      success: true;
      data: { visible: false; sessions: [] };
    }
  | {
      success: true;
      data: { visible: true; sessions: ParentWardSessionRow[] };
    }
  | { success: false; error: string };

export function useParentWardLessonSessions(wardId: string | null) {
  return useQuery({
    queryKey: ["parent-ward-lesson-sessions", wardId],
    queryFn: async (): Promise<ParentWardSessionsResponse> => {
      const res = await fetch(`/api/parent/wards/${wardId}/lesson-sessions`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as ParentWardSessionsResponse | null;
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
