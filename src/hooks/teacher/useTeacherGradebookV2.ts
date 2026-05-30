import { useQuery } from "@tanstack/react-query";
import type { TeacherGradebookV2DTO } from "@/types/academics/assessment-engine";

export type TeacherGradebookV2Response = {
  success: boolean;
  data: TeacherGradebookV2DTO;
  error?: string;
};

export function useTeacherGradebookV2(
  classGroupId?: string,
  subjectId?: string,
  academicPeriodId?: string | null
) {
  return useQuery<TeacherGradebookV2Response>({
    queryKey: [
      "teacher-gradebook-v2",
      classGroupId ?? "none",
      subjectId ?? "none",
      academicPeriodId ?? "current",
    ],
    queryFn: async () => {
      if (!classGroupId || !subjectId) {
        throw new Error("Missing gradebook identifiers");
      }

      const params = new URLSearchParams();
      if (academicPeriodId) {
        params.set("academicPeriodId", academicPeriodId);
      }

      const query = params.toString();
      const res = await fetch(
        `/api/teacher/marks/gradebooks/${encodeURIComponent(classGroupId)}/${encodeURIComponent(subjectId)}${query ? `?${query}` : ""}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as TeacherGradebookV2Response & { error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load gradebook");
      }
      return json;
    },
    enabled: Boolean(classGroupId && subjectId),
    staleTime: 30_000,
  });
}
