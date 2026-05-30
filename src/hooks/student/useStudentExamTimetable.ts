import { useQuery } from "@tanstack/react-query";
import type { PublishedExamTimetableDTO } from "@/types/academics/exam-scheduling-engine";

type PublishedExamTimetableResponse = {
  success: boolean;
  data: PublishedExamTimetableDTO;
  error?: string;
};

export function useStudentExamTimetable(periodId?: string | null) {
  return useQuery<PublishedExamTimetableResponse>({
    queryKey: ["studentExamTimetable", periodId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodId) params.set("periodId", periodId);
      const query = params.toString();
      const res = await fetch(
        `/api/student/exams/timetable${query ? `?${query}` : ""}`,
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
