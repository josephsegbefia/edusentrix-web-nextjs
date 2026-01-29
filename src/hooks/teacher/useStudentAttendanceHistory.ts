import { useQuery } from "@tanstack/react-query";

export type StudentAttendanceHistoryResponse = {
  success: boolean;
  data: {
    studentId: string;
    records: Array<{
      _id: string;
      date: string;
      type: "homeroom" | "period";
      status: "present" | "absent" | "late" | "excused";
      periodNumber: number | null;
      subjectId: string | null;
      lateMinutes: number | null;
      reason: string | null;
    }>;
  };
};

export function useStudentAttendanceHistory(studentId?: string, type?: "homeroom" | "period") {
  return useQuery<StudentAttendanceHistoryResponse>({
    queryKey: ["teacher-attendance-history", studentId, type],
    queryFn: async () => {
      if (!studentId) {
        return { success: true, data: { studentId: "", records: [] } } as StudentAttendanceHistoryResponse;
      }
      const searchParams = new URLSearchParams();
      if (type) searchParams.set("type", type);
      const res = await fetch(
        `/api/teacher/attendance/history/${studentId}?${searchParams.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch attendance history");
      return res.json();
    },
    enabled: !!studentId,
    staleTime: 30_000,
  });
}
