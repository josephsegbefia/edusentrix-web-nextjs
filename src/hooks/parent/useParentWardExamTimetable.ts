import { useQuery } from "@tanstack/react-query";
import type { PublishedExamTimetableDTO } from "@/types/academics/exam-scheduling-engine";

type PublishedExamTimetableResponse = {
  success: boolean;
  data: PublishedExamTimetableDTO;
  error?: string;
};

export function useParentWardExamTimetable(wardId: string | null, periodId?: string | null) {
  return useQuery<PublishedExamTimetableResponse>({
    queryKey: ["parentWardExamTimetable", wardId, periodId],
    enabled: Boolean(wardId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodId) params.set("periodId", periodId);
      const query = params.toString();
      const res = await fetch(
        `/api/parent/wards/${encodeURIComponent(wardId!)}/exams/timetable${query ? `?${query}` : ""}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as PublishedExamTimetableResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load exam timetable");
      }
      return json;
    },
  });
}
