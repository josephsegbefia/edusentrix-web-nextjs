import { useQuery } from "@tanstack/react-query";

export type ClassSubjectTeacherRow = {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teachers: Array<{
    id: string;
    assignmentId: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    photoUrl: string | null;
  }>;
};

type Response = {
  success: boolean;
  data: ClassSubjectTeacherRow[];
};

/**
 * Subject–teacher rows for a class (same source as Class → Subjects & teachers tab).
 * Pass academicPeriodId to align with the timetable period being edited.
 */
export function useClassSubjectTeachers(classId: string, academicPeriodId?: string) {
  return useQuery<Response>({
    queryKey: ["class-subject-teachers", classId, academicPeriodId || "current"],
    queryFn: async () => {
      if (!classId) {
        return { success: true, data: [] };
      }
      const params = new URLSearchParams();
      if (academicPeriodId) params.set("academicPeriodId", academicPeriodId);
      const q = params.toString();
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/subject-teachers${q ? `?${q}` : ""}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to load class subjects");
      }
      return res.json();
    },
    enabled: Boolean(classId),
    staleTime: 30_000,
  });
}
